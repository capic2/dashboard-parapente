import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArcType,
  BoundingSphere,
  Cartesian2,
  CallbackProperty,
  Cartesian3,
  Cartographic,
  Color,
  ConstantPositionProperty,
  Entity,
  HeadingPitchRange,
  HorizontalOrigin,
  Ion,
  JulianDate,
  LabelStyle,
  Math as CesiumMath,
  sampleTerrainMostDetailed,
  ShadowMode,
  Terrain,
  VerticalOrigin,
  Viewer as CesiumViewer,
} from 'cesium';
import { useFlightGPX } from '../../hooks/flights/useFlightGPX';
import { useFlight } from '../../hooks/flights/useFlight';
import {
  formatEta,
  useVideoExportStatus,
} from '../../hooks/flights/useVideoExportStatus';
import {
  getHeadingFromOrientation,
  getOrientationLabel,
  getOrientationOptions,
} from '../../utils/cameraOrientation';
import { getExportFrameTargetIndex } from '../../utils/videoExportFrame';
import { api } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast';
import { Button } from '@dashboard-parapente/design-system';
import { Disclosure, DisclosurePanel } from 'react-aria-components';
import { HTTPError } from 'ky';
import { useTranslation } from 'react-i18next';

import {
  GPXData,
  VIDEO_EXPORT_IN_PROGRESS_STATUSES,
  type Flight,
} from '@dashboard-parapente/shared-types';
import {
  computeCursorTelemetryLabel,
  DEFAULT_VIEWER_UNITS,
  getViewerUnitsFromStorage,
  type ViewerUnits,
} from './flightViewerTelemetry';

const isVideoExportInProgress = (status?: string | null) =>
  Boolean(status && VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(status));

type VideoExportMode = 'manual_fast' | 'manual';

const getHttpErrorDetail = async (error: HTTPError): Promise<string | null> => {
  try {
    const body = (await error.response.json()) as {
      detail?: unknown;
      message?: unknown;
    };
    const raw = body.detail ?? body.message;

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      return trimmed || null;
    }

    if (Array.isArray(raw)) {
      return raw.map((item) => String(item)).join(' • ');
    }

    if (raw && typeof raw === 'object') {
      return JSON.stringify(raw);
    }
  } catch {
    return null;
  }

  return null;
};

declare global {
  interface Window {
    _exportMode?: string;
    _cesiumViewer?: CesiumViewer;
    _gpxData?: GPXData & { positions: Cartesian3[]; timestamps: number[] };
    _setExportFrame?: (
      frameIndex: number,
      totalFrames: number
    ) => {
      index: number;
      progress: number;
      tilesLoaded: boolean;
    };
    _getExportMetadata?: () => {
      totalPoints: number;
      duration: number;
    };
  }
}

interface FlightViewer3DProps {
  flightId: string;
  flightTitle?: string;
  compact?: boolean;
}

/**
 * AccordionSection - Collapsible section component for control panel
 */
interface AccordionSectionProps {
  title: string;
  emoji?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  emoji = '',
  defaultOpen = false,
  children,
}) => {
  return (
    <Disclosure
      defaultExpanded={defaultOpen}
      className="border-b border-gray-200 dark:border-gray-700 last:border-0"
    >
      {({ isExpanded }) => (
        <>
          <Button
            slot="trigger"
            className="w-full flex items-center justify-between py-2 px-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded"
          >
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {emoji && <span className="mr-1.5">{emoji}</span>}
              {title}
            </span>
            <span
              className="text-gray-400 dark:text-gray-400 text-xs transition-transform"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▶
            </span>
          </Button>
          <DisclosurePanel className="pb-3 pt-1 space-y-3">
            {children}
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  );
};

/**
 * FlightViewer3D - 3D flight viewer using Cesium
 */
export const FlightViewer3D: React.FC<FlightViewer3DProps> = ({
  flightId,
  flightTitle,
  compact = false,
}) => {
  const { t } = useTranslation();
  const resolvedFlightTitle = flightTitle || t('flights.viewer.defaultTitle');
  const { data: gpxData, isLoading, error } = useFlightGPX(flightId);
  const { data: flight } = useFlight(flightId);
  const queryClient = useQueryClient();
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(10);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [terrainReady, setTerrainReady] = useState(false);
  const [elevationOffset, setElevationOffset] = useState(0);
  const [autoOffset, setAutoOffset] = useState(0);
  const [isCalculatingOffset, setIsCalculatingOffset] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(compact);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);
  const [videoExportMode, setVideoExportMode] =
    useState<VideoExportMode>('manual_fast');
  const [viewerUnits, setViewerUnits] = useState<ViewerUnits>(() =>
    typeof window === 'undefined'
      ? DEFAULT_VIEWER_UNITS
      : getViewerUnitsFromStorage(window.localStorage)
  );

  // Terrain rendering states
  const [terrainShadows, setTerrainShadows] = useState(true);
  const [ambientOcclusion, setAmbientOcclusion] = useState(false);
  const [sunTime, setSunTime] = useState(10); // 10:00
  const [lightIntensity, setLightIntensity] = useState(1.2);

  // Orientation editing state
  const [isUpdatingOrientation, setIsUpdatingOrientation] = useState(false);

  // Camera position editing state
  const [isUpdatingCamera, setIsUpdatingCamera] = useState(false);
  const [tempCameraAngle, setTempCameraAngle] = useState<number>(0);
  const [tempCameraDistance, setTempCameraDistance] = useState<number>(500);

  const allPositionsRef = useRef<Cartesian3[]>([]);
  const timestampsRef = useRef<number[]>([]);
  const currentIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(10);
  const realTimeStartRef = useRef<number>(0);
  const gpxStartTimeRef = useRef<number>(0);

  const polylineEntityRef = useRef<Entity | null>(null);
  const cursorEntityRef = useRef<Entity | null>(null);
  const startEntityRef = useRef<Entity | null>(null);
  const visiblePositionsRef = useRef<Cartesian3[]>([]);
  const cursorPositionPropertyRef = useRef<ConstantPositionProperty | null>(
    null
  );
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cameraHeadingRef = useRef<number>(0);
  const cameraDistanceRef = useRef<number>(500);
  const cameraTargetRef = useRef<Cartesian3 | null>(null);
  const containerDivRef = useRef<HTMLDivElement>(null);
  const viewerUnitsRef = useRef<ViewerUnits>(viewerUnits);

  const isExportActive = isVideoExportInProgress(flight?.video_export_status);
  const { status: exportStatus } = useVideoExportStatus(
    flight?.video_export_job_id,
    Boolean(flight?.video_export_job_id && isExportActive)
  );

  const exportProgress = Math.min(
    100,
    Math.max(0, Math.round(exportStatus?.progress ?? 0))
  );
  const exportEta = formatEta(exportStatus?.eta_seconds);

  useEffect(() => {
    if (!flightId || !exportStatus?.internal_status) {
      return;
    }

    if (
      exportStatus.internal_status === 'completed' ||
      exportStatus.internal_status === 'failed' ||
      exportStatus.internal_status === 'cancelled'
    ) {
      queryClient.invalidateQueries({
        queryKey: ['flights', flightId],
      });
    }
  }, [exportStatus?.internal_status, flightId, queryClient]);

  useEffect(() => {
    const refreshUnits = () => {
      const nextUnits = getViewerUnitsFromStorage(window.localStorage);
      setViewerUnits((previousUnits) => {
        if (
          previousUnits.altitude === nextUnits.altitude &&
          previousUnits.speed === nextUnits.speed
        ) {
          return previousUnits;
        }

        return nextUnits;
      });
    };

    refreshUnits();
    window.addEventListener('storage', refreshUnits);
    window.addEventListener('focus', refreshUnits);

    return () => {
      window.removeEventListener('storage', refreshUnits);
      window.removeEventListener('focus', refreshUnits);
    };
  }, []);

  useEffect(() => {
    viewerUnitsRef.current = viewerUnits;

    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      viewerRef.current.scene.requestRender();
    }
  }, [viewerUnits]);

  // Initialize Cesium Viewer
  useEffect(() => {
    let isMounted = true;
    let attemptCount = 0;
    const maxAttempts = 10;

    const tryCreateViewer = () => {
      attemptCount++;

      if (!isMounted) return;

      if (!containerRef.current) {
        if (attemptCount < maxAttempts) {
          setTimeout(tryCreateViewer, 100);
          return;
        }
        setViewerError('Container element not found after multiple attempts');
        return;
      }

      const container = containerRef.current;

      if (container.clientHeight === 0 || container.clientWidth === 0) {
        const errorMsg = `Container has zero dimensions (${container.clientWidth}x${container.clientHeight})`;
        setViewerError(errorMsg);
        return;
      }

      try {
        const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim();

        if (ionToken) {
          Ion.defaultAccessToken = ionToken;
        } else if (import.meta.env.PROD) {
          setViewerError(
            'VITE_CESIUM_ION_TOKEN is required to initialize Cesium World Terrain in production.'
          );
          return;
        }

        const viewer = new CesiumViewer(container, {
          terrain: Terrain.fromWorldTerrain(),
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          infoBox: false,
          selectionIndicator: false,
        });

        // Enable terrain collision detection
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;

        viewerRef.current = viewer;
        setViewerError(null);
        setViewerReady(true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setViewerError(errorMsg);
      }
    };

    // Start trying to create viewer after a small delay
    const initialTimeout = setTimeout(tryCreateViewer, 100);

    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
      setViewerReady(false);
    };
  }, []);

  // Monitor terrain loading status
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;

    // Reset terrain ready when checking
    setTerrainReady(false);

    // Check if terrain is already loaded
    const globe = viewer.scene.globe;
    let isMounted = true;

    const checkTerrainReady = () => {
      if (!isMounted) return;

      // Check if tiles are loaded in the current view
      const tilesLoaded = globe.tilesLoaded;

      if (tilesLoaded) {
        setTerrainReady(true);
      } else {
        // Check again after a short delay
        setTimeout(checkTerrainReady, 500);
      }
    };

    // Start checking after a small delay
    const timeoutId = setTimeout(checkTerrainReady, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [viewerReady, flightId]);

  // Réinitialiser les offsets quand on change de vol
  useEffect(() => {
    setElevationOffset(0);
    setAutoOffset(0);
    setTerrainReady(false); // Reset terrain ready state on flight change
  }, [flightId]);

  // Configure terrain rendering (shadows, AO, lighting)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;

    try {
      // 1. Terrain shadows
      viewer.shadows = terrainShadows;
      viewer.terrainShadows = terrainShadows
        ? ShadowMode.ENABLED
        : ShadowMode.DISABLED;

      // 2. Ambient Occlusion
      const aoStage = viewer.scene.postProcessStages.ambientOcclusion;
      if (aoStage) {
        aoStage.enabled = ambientOcclusion;
        if (ambientOcclusion) {
          aoStage.uniforms.intensity = 3.0;
          aoStage.uniforms.bias = 0.1;
          aoStage.uniforms.lengthCap = 0.03;
        }
      }

      // 3. Sun position (time of day)
      const dateStr = `2024-06-21T${sunTime.toString().padStart(2, '0')}:00:00Z`;
      viewer.clock.currentTime = JulianDate.fromIso8601(dateStr);

      // 4. Light intensity
      if (viewer.scene.light) {
        viewer.scene.light.intensity = lightIntensity;
      }
    } catch (error) {
      console.error('Error configuring terrain rendering:', error);
    }
  }, [terrainShadows, ambientOcclusion, sunTime, lightIntensity, viewerReady]);

  // Load GPX data
  useEffect(() => {
    if (!gpxData?.coordinates || gpxData.coordinates.length === 0) {
      return;
    }

    if (!viewerRef.current || viewerRef.current.isDestroyed()) {
      return;
    }

    const viewer = viewerRef.current;

    try {
      // Convert GPX coordinates to Cartesian3 avec offset d'élévation
      const positions = gpxData.coordinates.map((point) =>
        Cartesian3.fromDegrees(
          point.lon,
          point.lat,
          point.elevation + elevationOffset
        )
      );

      const timestamps = gpxData.coordinates.map((coord) => coord.timestamp);

      allPositionsRef.current = positions;
      timestampsRef.current = timestamps;
      currentIndexRef.current = 0;
      visiblePositionsRef.current = [positions[0]];

      // Expose data globally for video export (Playwright)
      if (typeof window !== 'undefined' && window._exportMode) {
        window._gpxData = {
          ...gpxData,
          positions: positions,
          timestamps: timestamps,
        };
        window._cesiumViewer = viewer;
      }

      // Clean old entities
      if (
        polylineEntityRef.current &&
        viewer.entities.contains(polylineEntityRef.current)
      ) {
        viewer.entities.remove(polylineEntityRef.current);
      }
      if (
        cursorEntityRef.current &&
        viewer.entities.contains(cursorEntityRef.current)
      ) {
        viewer.entities.remove(cursorEntityRef.current);
      }
      if (
        startEntityRef.current &&
        viewer.entities.contains(startEntityRef.current)
      ) {
        viewer.entities.remove(startEntityRef.current);
      }

      // Create polyline
      polylineEntityRef.current = viewer.entities.add({
        polyline: {
          positions: new CallbackProperty(
            () => visiblePositionsRef.current,
            false
          ),
          width: 2,
          material: Color.RED,
          clampToGround: false,
          arcType: ArcType.NONE,
        },
      });

      // Create cursor
      cursorPositionPropertyRef.current = new ConstantPositionProperty(
        positions[0]
      );
      cursorEntityRef.current = viewer.entities.add({
        position: cursorPositionPropertyRef.current,
        point: {
          pixelSize: 6,
          color: Color.YELLOW,
          outlineColor: Color.BLACK,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: new CallbackProperty(
            () =>
              computeCursorTelemetryLabel(
                currentIndexRef.current,
                gpxData.coordinates,
                elevationOffset,
                viewerUnitsRef.current
              ),
            false
          ),
          font: '600 12px sans-serif',
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.75),
          backgroundPadding: new Cartesian2(8, 6),
          pixelOffset: new Cartesian2(0, -28),
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      // Create start marker
      startEntityRef.current = viewer.entities.add({
        position: positions[0],
        point: {
          pixelSize: 8,
          color: Color.GREEN,
          outlineColor: Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      // Calculate bounding sphere for better camera positioning
      const boundingSphere = BoundingSphere.fromPoints(positions);

      // Calculate camera heading to face the takeoff point
      const calculateOptimalHeading = async (): Promise<number> => {
        if (gpxData.coordinates.length < 2) return 0;

        const numPoints = gpxData.coordinates.length;

        // Takeoff is at the beginning
        const takeoffCoord = gpxData.coordinates[0];

        // Use middle of the flight (50%) as reference for better perspective
        const referenceIndex = Math.floor(numPoints * 0.5);
        const referenceCoord = gpxData.coordinates[referenceIndex];

        // Calculate heading from reference point BACK to takeoff
        // This makes the camera look toward the takeoff/launch site
        const deltaLon = takeoffCoord.lon - referenceCoord.lon;

        // Calculate angle in radians
        // We need to convert lon/lat differences to proper bearing
        // Using standard bearing formula
        const y =
          Math.sin(deltaLon) * Math.cos((takeoffCoord.lat * Math.PI) / 180);
        const x =
          Math.cos((referenceCoord.lat * Math.PI) / 180) *
            Math.sin((takeoffCoord.lat * Math.PI) / 180) -
          Math.sin((referenceCoord.lat * Math.PI) / 180) *
            Math.cos((takeoffCoord.lat * Math.PI) / 180) *
            Math.cos(deltaLon);

        return Math.atan2(y, x);
      };

      // Position camera - MUST happen after elevation offset is calculated
      // Using a very low angle to see the altitude of the flight track
      const positionCamera = async () => {
        if (viewer && !viewer.isDestroyed()) {
          // Check if camera settings were already loaded from site (camera_angle/camera_distance)
          // Read directly from flight.site to avoid stale ref values
          const hasSavedCameraSettings =
            flight?.site?.camera_angle !== null &&
            flight?.site?.camera_angle !== undefined;

          let heading: number;
          let distance: number;

          if (hasSavedCameraSettings) {
            // Read camera settings directly from flight.site
            const cameraAngle = flight?.site?.camera_angle ?? 0;
            distance = flight?.site?.camera_distance || 500;
            heading = CesiumMath.toRadians(cameraAngle);

            // Also update refs for replay mode
            cameraHeadingRef.current = heading;
            cameraDistanceRef.current = distance;
          } else {
            // Calculate optimal heading automatically
            heading = await calculateOptimalHeading();
            distance = boundingSphere.radius * 0.8;
            cameraHeadingRef.current = heading;
            cameraDistanceRef.current = distance;
          }

          viewer.camera.flyToBoundingSphere(boundingSphere, {
            duration: 2,
            offset: new HeadingPitchRange(
              heading, // heading perpendicular to flight direction
              -0.05, // pitch: légèrement incliné vers le bas pour voir le sol
              distance // distance plus proche pour meilleure immersion
            ),
          });
        }
      };

      // Position immédiate
      setTimeout(() => positionCamera(), 500);
      // Re-position après calcul de l'offset (1.5s + 500ms)
      setTimeout(() => positionCamera(), 2500);
    } catch (err) {
      console.error('Error loading GPX data:', err);
    }

    return () => {
      // Reset play state when changing flights
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isPlayingRef.current = false;
      setIsPlaying(false);
      currentIndexRef.current = 0;
      setCurrentProgress(0);

      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      try {
        if (
          polylineEntityRef.current &&
          viewer.entities.contains(polylineEntityRef.current)
        ) {
          viewer.entities.remove(polylineEntityRef.current);
        }
        if (
          cursorEntityRef.current &&
          viewer.entities.contains(cursorEntityRef.current)
        ) {
          viewer.entities.remove(cursorEntityRef.current);
        }
        if (
          startEntityRef.current &&
          viewer.entities.contains(startEntityRef.current)
        ) {
          viewer.entities.remove(startEntityRef.current);
        }
      } catch (e) {
        console.debug('Cleanup warning:', e);
      }

      polylineEntityRef.current = null;
      cursorEntityRef.current = null;
      startEntityRef.current = null;
      isPlayingRef.current = false;
      currentIndexRef.current = 0;
      visiblePositionsRef.current = [];
    };
    // Intentionally exclude site camera fields to avoid replay reset after save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevationOffset, gpxData, viewerReady]);

  // Initialize camera settings from flight data
  useEffect(() => {
    if (flight?.site) {
      // Initialize angle from camera_angle or convert orientation to angle
      let initialAngle = flight.site.camera_angle || 0;
      if (!flight.site.camera_angle && flight.site.orientation) {
        initialAngle = getHeadingFromOrientation(flight.site.orientation) || 0;
      }
      setTempCameraAngle(initialAngle);
      setTempCameraDistance(flight.site.camera_distance || 500);
    }
  }, [flight?.site]);

  // Position camera based on site orientation
  useEffect(() => {
    if (
      !viewerRef.current ||
      !viewerReady ||
      !gpxData?.coordinates?.length ||
      !allPositionsRef.current.length
    ) {
      return;
    }

    const viewer = viewerRef.current;
    const firstPosition = allPositionsRef.current[0];

    if (!firstPosition) return;

    // Use camera_angle if set, otherwise fall back to orientation
    let cameraAngle: number | null | undefined = flight?.site?.camera_angle;
    if (cameraAngle === null || cameraAngle === undefined) {
      // Fallback to orientation if no angle set
      const orientation = flight?.site?.orientation || undefined;
      cameraAngle = getHeadingFromOrientation(orientation);
    }
    const cameraDistance = flight?.site?.camera_distance || 500;

    if (cameraAngle !== null && cameraAngle !== undefined) {
      // Camera is positioned at the specified angle, looking back at takeoff
      // The camera heading should be OPPOSITE to the camera angle
      const oppositeHeading = (cameraAngle + 180) % 360;

      // Save camera settings for replay mode
      cameraHeadingRef.current = CesiumMath.toRadians(cameraAngle);
      cameraDistanceRef.current = cameraDistance;

      // First, position camera at takeoff looking in the OPPOSITE direction
      viewer.camera.setView({
        destination: firstPosition,
        orientation: {
          heading: CesiumMath.toRadians(oppositeHeading), // Look back at takeoff
          pitch: CesiumMath.toRadians(-10), // Look slightly down
          roll: 0.0,
        },
      });

      // Then move camera FORWARD by the specified distance
      // This places camera ahead of takeoff, looking back at it
      viewer.camera.moveForward(cameraDistance);
    }
  }, [
    viewerReady,
    gpxData,
    flight?.site?.camera_angle,
    flight?.site?.camera_distance,
    flight?.site?.orientation,
  ]);

  // Calculer automatiquement l'offset d'élévation
  const calculateAutoElevationOffset = useCallback(async () => {
    if (!viewerRef.current || !gpxData?.coordinates?.[0]) return;

    setIsCalculatingOffset(true);

    try {
      const viewer = viewerRef.current;
      const firstPoint = gpxData.coordinates[0];

      // Créer une position cartographique pour le premier point
      const position = Cartesian3.fromDegrees(firstPoint.lon, firstPoint.lat);
      const cartographic = Cartographic.fromCartesian(position);

      // Échantillonner le terrain pour obtenir la hauteur réelle du sol
      const terrainProvider = viewer.terrainProvider;
      const samples = await sampleTerrainMostDetailed(terrainProvider, [
        cartographic,
      ]);

      if (samples && samples.length > 0 && samples[0].height !== undefined) {
        const terrainHeight = samples[0].height;
        const gpsElevation = firstPoint.elevation;

        // Calculer l'offset nécessaire pour que le pilote soit au-dessus du terrain
        // Si terrain = 1000m et GPS = 800m, offset = 1000 - 800 = +200m (on monte le pilote)
        // Si terrain = 1000m et GPS = 1200m, offset = 1000 - 1200 = -200m (on descend le pilote)
        const offset = terrainHeight - gpsElevation;

        setAutoOffset(offset);
        setElevationOffset(offset);
        // Le flyTo se fera automatiquement via le useEffect qui dépend de elevationOffset
      }
    } catch (error) {
      console.error("Erreur lors du calcul de l'offset d'élévation:", error);
    } finally {
      setIsCalculatingOffset(false);
    }
  }, [gpxData]);

  // Activer l'auto-élévation par défaut au chargement
  useEffect(() => {
    if (
      viewerRef.current &&
      viewerReady &&
      gpxData?.coordinates?.length &&
      elevationOffset === 0 &&
      autoOffset === 0 &&
      !isCalculatingOffset
    ) {
      // Attendre que le terrain soit chargé
      const timer = setTimeout(() => {
        calculateAutoElevationOffset();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [
    gpxData,
    calculateAutoElevationOffset,
    elevationOffset,
    autoOffset,
    isCalculatingOffset,
    viewerReady,
  ]);

  // Écouter les changements de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    setIsPanelCollapsed(compact);
  }, [compact]);

  const panelClassName = compact
    ? isPanelCollapsed
      ? 'p-1.5'
      : 'p-2 max-w-[220px]'
    : isPanelCollapsed
      ? 'p-2'
      : 'p-4 max-w-xs';

  const fullscreenButtonClassName = compact
    ? 'px-2 py-1.5 text-xs'
    : 'px-3 py-2';
  const compactControlButtonClassName = compact
    ? 'px-2 py-1.5 text-xs'
    : 'px-3 py-2 text-sm';
  const compactTitleClass = compact ? 'text-sm font-bold' : 'text-lg font-bold';
  const compactToggleButtonClassName = compact
    ? 'px-1.5 py-0.5 text-xs'
    : 'px-2 py-1 text-sm';

  const toggleFullscreen = () => {
    if (!containerDivRef.current) return;

    if (!isFullscreen) {
      if (containerDivRef.current.requestFullscreen) {
        containerDivRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const setSceneToIndex = useCallback((targetIndex: number) => {
    const lastIndex = allPositionsRef.current.length - 1;
    if (lastIndex < 0) {
      return { index: 0, progress: 0, tilesLoaded: false };
    }

    const safeIndex = Math.min(Math.max(targetIndex, 0), lastIndex);
    currentIndexRef.current = safeIndex;
    visiblePositionsRef.current = allPositionsRef.current.slice(
      0,
      safeIndex + 1
    );

    if (timestampsRef.current.length > 0) {
      const currentTimestamp = timestampsRef.current[safeIndex];
      const startTimestamp = timestampsRef.current[0];
      setCurrentElapsedTime((currentTimestamp - startTimestamp) / 1000);
    }

    if (
      cursorPositionPropertyRef.current &&
      allPositionsRef.current[safeIndex]
    ) {
      cursorPositionPropertyRef.current.setValue(
        allPositionsRef.current[safeIndex]
      );
    }

    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) {
      const currentPosition = allPositionsRef.current[safeIndex];
      const heading = cameraHeadingRef.current;
      const distance = cameraDistanceRef.current;
      const pitch = -0.05;

      cameraTargetRef.current = currentPosition;
      viewer.camera.setView({
        destination: currentPosition,
        orientation: {
          heading,
          pitch,
          roll: 0,
        },
      });
      viewer.camera.moveBackward(distance);

      const cameraCartographic = Cartographic.fromCartesian(
        viewer.camera.position
      );
      const globe = viewer.scene.globe;
      const terrainHeight = globe.getHeight(cameraCartographic);

      if (
        terrainHeight !== undefined &&
        cameraCartographic.height < terrainHeight + 50
      ) {
        cameraCartographic.height = terrainHeight + 50;
        viewer.camera.position = Cartesian3.fromRadians(
          cameraCartographic.longitude,
          cameraCartographic.latitude,
          cameraCartographic.height
        );
      }

      viewer.scene.requestRender();
      viewer.scene.render(viewer.clock.currentTime);
    }

    const progress = lastIndex > 0 ? (safeIndex / lastIndex) * 100 : 0;
    setCurrentProgress(progress);

    return {
      index: safeIndex,
      progress,
      tilesLoaded: Boolean(viewer?.scene.globe.tilesLoaded),
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window._exportMode) {
      return;
    }

    window._setExportFrame = (frameIndex: number, totalFrames: number) => {
      const targetIndex = getExportFrameTargetIndex(
        frameIndex,
        totalFrames,
        allPositionsRef.current.length
      );

      return setSceneToIndex(targetIndex);
    };

    window._getExportMetadata = () => ({
      totalPoints: allPositionsRef.current.length,
      duration:
        gpxData?.flight_duration_seconds || allPositionsRef.current.length || 300,
    });

    return () => {
      window._setExportFrame = undefined;
      window._getExportMetadata = undefined;
    };
  }, [gpxData?.flight_duration_seconds, setSceneToIndex]);

  const play = useCallback(() => {
    if (intervalRef.current || allPositionsRef.current.length === 0) return;

    isPlayingRef.current = true;
    setIsPlaying(true);

    realTimeStartRef.current = Date.now();
    gpxStartTimeRef.current = timestampsRef.current[currentIndexRef.current];

    intervalRef.current = setInterval(() => {
      if (currentIndexRef.current >= allPositionsRef.current.length - 1) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        isPlayingRef.current = false;
        setIsPlaying(false);
        return;
      }

      // Utiliser la vitesse directement (x1 = temps réel, x10 par défaut)
      const speed = speedRef.current;
      const elapsedRealTime = Date.now() - realTimeStartRef.current;
      const elapsedGpxTime = elapsedRealTime * speed;
      const targetGpxTime = gpxStartTimeRef.current + elapsedGpxTime;

      let targetIndex = currentIndexRef.current;
      for (
        let i = currentIndexRef.current;
        i < timestampsRef.current.length;
        i++
      ) {
        if (timestampsRef.current[i] <= targetGpxTime) {
          targetIndex = i;
        } else {
          break;
        }
      }

      if (targetIndex > currentIndexRef.current) {
        currentIndexRef.current = targetIndex;
        visiblePositionsRef.current = allPositionsRef.current.slice(
          0,
          currentIndexRef.current + 1
        );

        // Calculate elapsed time
        if (timestampsRef.current.length > 0) {
          const currentTimestamp =
            timestampsRef.current[currentIndexRef.current];
          const startTimestamp = timestampsRef.current[0];
          const elapsedMs = currentTimestamp - startTimestamp;
          setCurrentElapsedTime(elapsedMs / 1000); // Convert to seconds
        }

        if (cursorPositionPropertyRef.current) {
          cursorPositionPropertyRef.current.setValue(
            allPositionsRef.current[currentIndexRef.current]
          );
        }

        // Suivre le curseur avec la caméra
        const viewer = viewerRef.current;
        if (viewer && !viewer.isDestroyed()) {
          const currentPosition =
            allPositionsRef.current[currentIndexRef.current];
          const heading = cameraHeadingRef.current;
          const distance = cameraDistanceRef.current;
          const pitch = -0.05;

          // Smooth lerp vers la position actuelle
          if (!cameraTargetRef.current) {
            cameraTargetRef.current = currentPosition;
          } else {
            const lerpFactor = 0.08;
            cameraTargetRef.current = new Cartesian3(
              cameraTargetRef.current.x +
                (currentPosition.x - cameraTargetRef.current.x) * lerpFactor,
              cameraTargetRef.current.y +
                (currentPosition.y - cameraTargetRef.current.y) * lerpFactor,
              cameraTargetRef.current.z +
                (currentPosition.z - cameraTargetRef.current.z) * lerpFactor
            );
          }

          // Use setView instead of lookAt for better control
          viewer.camera.setView({
            destination: cameraTargetRef.current,
            orientation: {
              heading: heading,
              pitch: pitch,
              roll: 0,
            },
          });

          // Move camera back by distance
          viewer.camera.moveBackward(distance);

          // Check terrain collision and adjust camera height if needed
          const cameraCartographic = Cartographic.fromCartesian(
            viewer.camera.position
          );
          const globe = viewer.scene.globe;
          const terrainHeight = globe.getHeight(cameraCartographic);

          if (
            terrainHeight !== undefined &&
            cameraCartographic.height < terrainHeight + 50
          ) {
            // Camera is too low, lift it above terrain (minimum 50m above ground)
            cameraCartographic.height = terrainHeight + 50;
            viewer.camera.position = Cartesian3.fromRadians(
              cameraCartographic.longitude,
              cameraCartographic.latitude,
              cameraCartographic.height
            );
          }
        }

        // Mettre à jour le slider de progression
        const progress =
          (currentIndexRef.current / (allPositionsRef.current.length - 1)) *
          100;
        setCurrentProgress(progress);

        // Forcer le rendu Cesium pour mettre à jour la polyline progressive
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.scene.requestRender();
        }
      }
    }, 16);
  }, []);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const reset = useCallback(() => {
    pause();
    currentIndexRef.current = 0;
    setCurrentProgress(0);
    setCurrentElapsedTime(0);

    if (allPositionsRef.current.length > 0) {
      visiblePositionsRef.current = [allPositionsRef.current[0]];

      if (cursorPositionPropertyRef.current) {
        cursorPositionPropertyRef.current.setValue(allPositionsRef.current[0]);
      }

      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.scene.requestRender();
      }
    }
  }, [pause]);

  const handleProgressChange = useCallback(
    (value: number) => {
      const wasPlaying = isPlayingRef.current;

      // Pause si en lecture
      if (wasPlaying) {
        pause();
      }

      // Calculer le nouvel index
      const newIndex = Math.floor(
        (value / 100) * (allPositionsRef.current.length - 1)
      );
      currentIndexRef.current = newIndex;
      setCurrentProgress(value);

      // Mettre à jour la trace visible
      visiblePositionsRef.current = allPositionsRef.current.slice(
        0,
        newIndex + 1
      );

      // Mettre à jour le curseur
      if (
        cursorPositionPropertyRef.current &&
        allPositionsRef.current[newIndex]
      ) {
        cursorPositionPropertyRef.current.setValue(
          allPositionsRef.current[newIndex]
        );
      }

      // Forcer le rendu
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.scene.requestRender();
      }

      // Reprendre la lecture si elle était active
      if (wasPlaying) {
        setTimeout(() => play(), 50);
      }
    },
    [pause, play]
  );

  const handleSpeedChange = (value: number) => {
    setReplaySpeed(value);
    speedRef.current = value;

    if (isPlayingRef.current) {
      pause();
      setTimeout(() => play(), 50);
    }
  };

  const startVideoExport = useCallback(async () => {
    await api.post(`flights/${flightId}/export-video`, {
      searchParams: {
        mode: videoExportMode,
      },
    });

    queryClient.invalidateQueries({
      queryKey: ['flights', flightId],
    });
  }, [flightId, queryClient, videoExportMode]);

  /**
   * Update site orientation
   */
  const updateOrientation = async (newOrientation: string) => {
    if (!flight?.site?.id) return;

    setIsUpdatingOrientation(true);
    try {
      await api.patch(
        `sites/${flight.site.id}/orientation?orientation=${newOrientation}`
      );

      // Refresh flight data to get updated site
      await queryClient.invalidateQueries({ queryKey: ['flights', flightId] });
    } catch (error) {
      console.error('❌ Failed to update orientation:', error);
      toast.error(t('flights.viewer.orientationUpdateError'));
    } finally {
      setIsUpdatingOrientation(false);
    }
  };

  const updateCameraSettings = async (
    angle: number,
    distance: number
  ): Promise<boolean> => {
    if (!flight?.site?.id) {
      console.error('No site ID available');
      return false;
    }

    setIsUpdatingCamera(true);
    try {
      const params = new URLSearchParams();
      params.append('angle', angle.toString());
      params.append('distance', distance.toString());

      await api.patch(`sites/${flight.site.id}/camera?${params.toString()}`);

      queryClient.setQueryData<Flight | undefined>(
        ['flights', flightId],
        (previousFlightData) => {
          if (!previousFlightData) {
            return previousFlightData;
          }

          const previousSite = previousFlightData.site;
          if (!previousSite) {
            return previousFlightData;
          }

          return {
            ...previousFlightData,
            site: {
              ...previousSite,
              camera_angle: angle,
              camera_distance: distance,
            },
          };
        }
      );

      // Keep playback stable and do not trigger a full viewer reload.
      console.log(
        `✅ Camera settings saved for site "${flight?.site?.name}": ${angle}° / ${distance}m`
      );
    } catch (error) {
      console.error('Failed to update camera settings:', error);
      toast.error(t('flights.viewer.cameraUpdateError'));
      return false;
    } finally {
      setIsUpdatingCamera(false);
    }

    return true;
  };

  // Function to manually reposition camera (can be called after settings update)
  const repositionCamera = useCallback((angle: number, distance: number) => {
    if (!viewerRef.current || !allPositionsRef.current.length) {
      return;
    }

    const viewer = viewerRef.current;
    const index =
      allPositionsRef.current.length > 0 ? currentIndexRef.current : 0;
    const position =
      allPositionsRef.current[index] || allPositionsRef.current[0];
    if (!position) {
      return;
    }

    // Update refs for replay mode
    cameraHeadingRef.current = CesiumMath.toRadians(angle);
    cameraDistanceRef.current = distance;

    // Calculate opposite heading (camera looks back at takeoff)
    const oppositeHeading = (angle + 180) % 360;

    // Position camera
    viewer.camera.setView({
      destination: position,
      orientation: {
        heading: CesiumMath.toRadians(oppositeHeading),
        pitch: CesiumMath.toRadians(-10),
        roll: 0.0,
      },
    });

    // Move camera forward to position it at specified distance
    viewer.camera.moveForward(distance);
  }, []);

  const applyCameraToCurrentPlayback = (showToast = true) => {
    if (!allPositionsRef.current.length) {
      toast.info(t('flights.viewer.noTrackForCamera'));
      return;
    }

    repositionCamera(tempCameraAngle, tempCameraDistance);
    if (showToast) {
      toast.success(t('flights.viewer.cameraAppliedToPlayback'));
    }
  };

  const saveCameraSettings = async () => {
    const saved = await updateCameraSettings(
      tempCameraAngle,
      tempCameraDistance
    );
    if (!saved) {
      return;
    }
    toast.success(
      t('flights.viewer.cameraSavedForSite', {
        name: flight?.site?.name || t('flights.notSpecified'),
      })
    );

    // Keep current viewport in sync after save without reloading the viewer.
    setTimeout(() => {
      applyCameraToCurrentPlayback(false);
    }, 150);
  };

  // Render error messages as overlays instead of early returns
  // This ensures the Cesium container is always rendered
  /**
   * Format seconds to "Xmin Ys" format
   */
  const formatFlightTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0min 00s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}min ${secs.toString().padStart(2, '0')}s`;
  };

  const renderOverlay = () => {
    if (isLoading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 z-20">
          <div className="text-center p-8">
            <p className="text-lg dark:text-white">
              ⏳ {t('flights.loading3dViewer')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              {t('flights.viewer.loadingGpsAndTerrain')}
            </p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-yellow-50 dark:bg-yellow-900/20 z-20">
          <div className="bg-white dark:bg-gray-800 border-2 border-yellow-400 rounded-xl p-8 text-center max-w-md">
            <p className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-2">
              📍 {t('flights.viewer.noGpsTrack')}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {t('flights.viewer.noGpsTrackDescription')}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
              {t('flights.viewer.retrySoon')}
            </p>
          </div>
        </div>
      );
    }

    if (!gpxData?.coordinates) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900/20 z-20">
          <div className="text-center p-8">
            <p className="text-lg dark:text-white">
              ❌ {t('flights.viewer.noGpsData')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              {t('flights.viewer.trackUnavailable')}
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  // Show viewer error if viewer failed to initialize
  if (viewerError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-400 rounded-xl p-8 text-center">
        <p className="text-lg font-bold text-red-800 dark:text-red-200 mb-2">
          ❌ {t('flights.viewer.cesiumInitError')}
        </p>
        <p className="text-sm text-red-700 dark:text-red-300 mb-4">
          {t('flights.viewer.cesiumInitErrorDescription')}
        </p>
        <div className="bg-white dark:bg-gray-800 p-4 rounded text-left text-xs font-mono">
          <p className="font-bold mb-2 dark:text-white">{t('common.error')}:</p>
          <p className="text-red-600 dark:text-red-400">{viewerError}</p>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-4">
          {t('flights.viewer.checkConsole')}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerDivRef}
      className="relative w-full bg-gray-900"
      style={{ height: isFullscreen ? '100vh' : compact ? '420px' : '600px' }}
    >
      {/* Overlay for loading/error states */}
      {renderOverlay()}

      {/* Bouton plein écran */}
      {gpxData?.coordinates && (
        <Button
          onClick={toggleFullscreen}
          className={`absolute top-4 right-4 z-10 bg-gray-800 text-white rounded-lg shadow-lg hover:bg-gray-700 ${fullscreenButtonClassName}`}
          title={
            isFullscreen
              ? t('flights.viewer.exitFullscreen')
              : t('flights.viewer.fullscreen')
          }
        >
          {isFullscreen
            ? `🗗 ${t('flights.viewer.exit')}`
            : `⛶ ${t('flights.viewer.fullscreen')}`}
        </Button>
      )}

      {/* Controls - only show when data is loaded */}
      {gpxData?.coordinates && (
        <div
          className={`absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg transition-all ${panelClassName} max-h-[calc(100%-2rem)] overflow-hidden flex flex-col`}
        >
          <div className="flex items-center justify-between mb-2">
            {!isPanelCollapsed && (
              <h3 className={compactTitleClass}>🪂 {resolvedFlightTitle}</h3>
            )}
            <Button
              onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
              className={`${compactToggleButtonClassName} bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-600 dark:text-gray-200`}
              title={
                isPanelCollapsed
                  ? t('flights.viewer.openPanel')
                  : t('flights.viewer.collapsePanel')
              }
            >
              {isPanelCollapsed ? '▶' : '◀'}
            </Button>
          </div>

          {!isPanelCollapsed && (
            <div className="min-h-0 overflow-y-auto pr-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {t('flights.viewer.points')}:{' '}
                {gpxData?.coordinates?.length || 0}
              </p>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Terrain Loading Indicator - Outside accordion, always visible */}
                {!terrainReady && (
                  <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-400 rounded p-2 mb-3">
                    <p className="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      {t('flights.viewer.loadingTerrainTextures')}
                    </p>
                  </div>
                )}

                {/* ========== SECTION 1: LECTURE ========== */}
                <AccordionSection
                  title={t('flights.viewer.playbackSection')}
                  emoji="🎮"
                  defaultOpen={true}
                >
                  <div className="flex gap-2">
                    <Button
                      onClick={togglePlayPause}
                      className={`${compactControlButtonClassName} bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400`}
                      data-testid="flight-play-toggle"
                    >
                      {isPlaying
                        ? `⏸ ${t('flights.viewer.pause')}`
                        : `▶ ${t('flights.viewer.play')}`}
                    </Button>
                    <Button
                      onClick={reset}
                      className={`${compactControlButtonClassName} bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400`}
                    >
                      ⏮ {t('common.reset')}
                    </Button>
                  </div>

                  {/* Progress Slider */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t('flights.viewer.position')}:{' '}
                      {currentIndexRef.current + 1}/
                      {allPositionsRef.current.length}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={currentProgress}
                      onChange={(e) =>
                        handleProgressChange(Number(e.target.value))
                      }
                      className="w-full"
                      data-testid="flight-progress-slider"
                    />
                  </div>

                  {/* Flight Time Display */}
                  <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    ⏱️ {formatFlightTime(currentElapsedTime)} /{' '}
                    {formatFlightTime(gpxData?.flight_duration_seconds || 0)}
                  </div>

                  {/* Speed Slider */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t('flights.viewer.speed')}: {replaySpeed}x
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="32"
                      value={replaySpeed}
                      onChange={(e) =>
                        handleSpeedChange(Number(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                </AccordionSection>

                {/* ========== SECTION 2: VIDÉO ========== */}
                {flight?.gpx_file_path && (
                  <AccordionSection
                    title={t('flights.viewer.videoSection')}
                    emoji="📹"
                    defaultOpen={false}
                  >
                    <>
                      {!isVideoExportInProgress(flight.video_export_status) && (
                        <div className="mb-3 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/30">
                          <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">
                            {t('flights.viewer.videoExportMode')}
                          </label>
                          <select
                            value={videoExportMode}
                            onChange={(event) =>
                              setVideoExportMode(
                                event.target.value as VideoExportMode
                              )
                            }
                            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          >
                            <option value="manual_fast">
                              {t('flights.viewer.videoModeManualFast')}
                            </option>
                            <option value="manual">
                              {t('flights.viewer.videoModeManual')}
                            </option>
                          </select>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {videoExportMode === 'manual_fast'
                              ? t('flights.viewer.videoModeManualFastHint')
                              : t('flights.viewer.videoModeManualHint')}
                          </p>
                        </div>
                      )}

                      {/* Download/Generate Button */}
                      <Button
                        onClick={async () => {
                          if (
                            flight.video_export_status === 'completed' &&
                            flight.video_file_path
                          ) {
                            // Download video with authenticated API client
                            try {
                              const blob = await api
                                .get(
                                  `exports/${flight.video_export_job_id}/download`
                                )
                                .blob();

                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `flight-${flightId}.mp4`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch (error) {
                              if (error instanceof HTTPError) {
                                const detail = await getHttpErrorDetail(error);
                                toast.error(
                                  detail || t('flights.viewer.videoDownloadError')
                                );
                                return;
                              }

                              console.error('Failed to download video:', error);
                              toast.error(t('flights.viewer.videoDownloadError'));
                            }
                          } else if (
                            !flight.video_export_status ||
                            flight.video_export_status === 'failed'
                          ) {
                            // Generate video
                            try {
                              await startVideoExport();
                            } catch (error) {
                              if (error instanceof HTTPError) {
                                const detail = await getHttpErrorDetail(error);
                                toast.error(
                                  detail || t('flights.viewer.videoStartError')
                                );
                                return;
                              }

                              console.error(
                                '❌ Failed to start video generation:',
                                error
                              );
                              toast.error(
                                t('flights.viewer.videoStartGenericError')
                              );
                            }
                          }
                        }}
                        disabled={isVideoExportInProgress(
                          flight.video_export_status
                        )}
                        className={`w-full ${compactControlButtonClassName} text-white rounded ${
                          flight.video_export_status === 'completed'
                            ? 'mb-2'
                            : 'mb-3'
                        } ${
                          flight.video_export_status === 'completed'
                            ? 'bg-green-600 hover:bg-green-700'
                            : isVideoExportInProgress(
                                  flight.video_export_status
                                )
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        title={
                          isVideoExportInProgress(flight.video_export_status)
                            ? t('flights.viewer.videoGeneratingTitle')
                            : flight.video_export_status === 'completed'
                              ? t('flights.viewer.videoDownloadTitle')
                              : flight.video_export_status === 'failed' ||
                                  flight.video_export_status === 'cancelled'
                                ? t('flights.viewer.videoRegenerateTitle')
                                : t('flights.viewer.videoGenerateTitle')
                        }
                      >
                        {isVideoExportInProgress(flight.video_export_status) &&
                          `⏳ ${t('flights.viewer.videoGenerating')}`}
                        {flight.video_export_status === 'completed' &&
                          `📥 ${t('flights.viewer.downloadVideo')}`}
                        {(flight.video_export_status === 'failed' ||
                          flight.video_export_status === 'cancelled') &&
                          `🔄 ${t('flights.viewer.regenerateVideo')}`}
                        {!flight.video_export_status &&
                          `🎥 ${t('flights.viewer.generateVideo')}`}
                      </Button>

                      {isVideoExportInProgress(flight.video_export_status) &&
                        flight.video_export_job_id && (
                          <div className="mb-3 rounded border border-blue-200 bg-blue-50 p-2 dark:border-blue-700 dark:bg-blue-900/20">
                            <div className="mb-1 flex items-center justify-between text-xs font-medium text-blue-900 dark:text-blue-100">
                              <span>{t('flights.viewer.videoProgress')}</span>
                              <span>{exportProgress}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded bg-blue-100 dark:bg-blue-950/40">
                              <div
                                className="h-full rounded bg-blue-600 transition-all duration-500"
                                style={{ width: `${exportProgress}%` }}
                              />
                            </div>
                            <p className="mt-2 text-xs text-blue-900 dark:text-blue-100">
                              {exportStatus?.message ||
                                t('flights.viewer.videoGenerating')}
                            </p>
                            {exportEta && (
                              <p className="mt-1 text-xs text-blue-900 dark:text-blue-100">
                                {t('flights.viewer.videoEta', {
                                  time: exportEta,
                                })}
                              </p>
                            )}
                          </div>
                        )}

                      {/* Cancel Button (only when export is active) */}
                      {isVideoExportInProgress(flight.video_export_status) &&
                        flight.video_export_job_id && (
                          <Button
                            onClick={async () => {
                              if (
                                !confirm(
                                  t('flights.viewer.confirmCancelGeneration')
                                )
                              ) {
                                return;
                              }

                              try {
                                await api.delete(
                                  `exports/${flight.video_export_job_id}/cancel`
                                );

                                // Refresh flight data to get updated status
                                queryClient.invalidateQueries({
                                  queryKey: ['flights', flightId],
                                });
                              } catch (error) {
                                if (error instanceof HTTPError) {
                                  const detail =
                                    await getHttpErrorDetail(error);
                                  toast.error(
                                    detail ||
                                      t('flights.viewer.cancelGenerationError')
                                  );
                                  return;
                                }

                                console.error(
                                  'Failed to cancel video generation:',
                                  error
                                );
                                toast.error(t('flights.viewer.cancelError'));
                              }
                            }}
                            className="w-full px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 mb-3"
                            title={t('flights.viewer.cancelGenerationTitle')}
                          >
                            🛑 {t('flights.viewer.cancelGeneration')}
                          </Button>
                        )}

                      {/* Regenerate Button (only when video exists) */}
                      {flight.video_export_status === 'completed' && (
                        <Button
                          onClick={async () => {
                            if (
                              !confirm(
                                t('flights.viewer.confirmRegenerateVideo')
                              )
                            ) {
                              return;
                            }

                            try {
                              await startVideoExport();
                            } catch (error) {
                              if (error instanceof HTTPError) {
                                const detail = await getHttpErrorDetail(error);
                                toast.error(
                                  detail ||
                                    t('flights.viewer.regenerateStartError')
                                );
                                return;
                              }

                              console.error(
                                'Failed to regenerate video:',
                                error
                              );
                              toast.error(t('flights.viewer.regenerateError'));
                            }
                          }}
                          className="w-full px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 mb-3"
                          title={t('flights.viewer.regenerateTitle')}
                        >
                          🔄 {t('flights.viewer.regenerateVideo')}
                        </Button>
                      )}
                    </>
                  </AccordionSection>
                )}

                {/* ========== SECTION 3: SITE & CAMÉRA ========== */}
                {flight?.site && (
                  <AccordionSection
                    title={t('flights.viewer.siteCameraSection')}
                    emoji="🏔️"
                    defaultOpen={false}
                  >
                    {/* Orientation Selector */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {t('flights.viewer.takeoffOrientation')}
                      </label>
                      <select
                        value={flight.site.orientation || ''}
                        onChange={(e) => updateOrientation(e.target.value)}
                        disabled={isUpdatingOrientation}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">{t('flights.notSpecified')}</option>
                        {getOrientationOptions().map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {flight.site.orientation
                          ? t('flights.viewer.directionValue', {
                              value: getOrientationLabel(
                                flight.site.orientation
                              ),
                            })
                          : t('flights.viewer.directionPilotLooks')}
                      </p>
                    </div>

                    {/* Camera Position Controls */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
                      <label className="block text-sm font-medium mb-2 text-blue-900 dark:text-blue-100">
                        📷 {t('flights.viewer.cameraPosition')}
                      </label>

                      {/* Camera Angle */}
                      <div className="mb-2">
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                          {t('editSite.angle')}: {tempCameraAngle}°{' '}
                          {tempCameraAngle === 0
                            ? `(${t('flights.viewer.north')})`
                            : tempCameraAngle === 90
                              ? `(${t('flights.viewer.east')})`
                              : tempCameraAngle === 180
                                ? `(${t('flights.viewer.south')})`
                                : tempCameraAngle === 270
                                  ? `(${t('flights.viewer.west')})`
                                  : ''}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="5"
                          value={tempCameraAngle}
                          onChange={(e) =>
                            setTempCameraAngle(Number(e.target.value))
                          }
                          className="w-full"
                          data-testid="camera-angle-slider"
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>0° (N)</span>
                          <span>90° (E)</span>
                          <span>180° (S)</span>
                          <span>270° (W)</span>
                        </div>
                      </div>

                      {/* Camera Distance */}
                      <div className="mb-2">
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                          {t('editSite.distance')}: {tempCameraDistance}m
                        </label>
                        <input
                          type="range"
                          min="100"
                          max="2000"
                          step="50"
                          value={tempCameraDistance}
                          onChange={(e) =>
                            setTempCameraDistance(Number(e.target.value))
                          }
                          className="w-full"
                          data-testid="camera-distance-slider"
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>100m</span>
                          <span>2000m</span>
                        </div>
                      </div>

                      {/* Camera Apply Buttons */}
                      <div className="space-y-2">
                        <Button
                          onClick={() => applyCameraToCurrentPlayback()}
                          className={`w-full ${compactControlButtonClassName} bg-blue-600 text-white rounded hover:bg-blue-700`}
                          data-testid="camera-apply-button"
                        >
                          👁️ {t('flights.viewer.applyToPlayback')}
                        </Button>
                        <Button
                          onClick={saveCameraSettings}
                          disabled={isUpdatingCamera}
                          className={`w-full ${compactControlButtonClassName} bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                          data-testid="camera-save-button"
                        >
                          {isUpdatingCamera
                            ? `⏳ ${t('editSite.saving')}`
                            : `💾 ${t('flights.viewer.saveSiteSetting')}`}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                        💡 {t('flights.viewer.applyThenSaveHint')}
                      </p>
                    </div>
                  </AccordionSection>
                )}

                {/* ========== SECTION 4: RENDU & ÉLÉVATION ========== */}
                <AccordionSection
                  title={t('flights.viewer.renderElevationSection')}
                  emoji="🎨"
                  defaultOpen={false}
                >
                  {/* Elevation Offset */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium">
                        {t('flights.viewer.elevation')}:{' '}
                        {elevationOffset.toFixed(1)}m
                      </label>
                      <Button
                        onClick={calculateAutoElevationOffset}
                        disabled={isCalculatingOffset}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                        title={t('flights.viewer.calculateAutoOffsetTitle')}
                      >
                        {isCalculatingOffset ? '⏳' : '🔄'}{' '}
                        {t('settings.languageTheme.auto')}
                      </Button>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={elevationOffset}
                      onChange={(e) =>
                        setElevationOffset(Number(e.target.value))
                      }
                      className="w-full"
                    />
                    {autoOffset !== 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('flights.viewer.autoOffset')}:{' '}
                        {autoOffset.toFixed(1)}m
                      </p>
                    )}
                  </div>

                  {/* Terrain Shadows Toggle */}
                  <div>
                    <label className="flex items-center text-sm mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={terrainShadows}
                        onChange={(e) => setTerrainShadows(e.target.checked)}
                        className="mr-2 cursor-pointer"
                      />
                      {t('flights.viewer.terrainShadows')}
                    </label>

                    {/* Ambient Occlusion Toggle */}
                    <label className="flex items-center text-sm mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ambientOcclusion}
                        onChange={(e) => setAmbientOcclusion(e.target.checked)}
                        className="mr-2 cursor-pointer"
                      />
                      {t('flights.viewer.ambientOcclusion')}
                    </label>

                    {/* Sun Time Slider */}
                    <div className="mt-2">
                      <label className="block text-sm font-medium mb-1">
                        {t('flights.viewer.hour')}: {sunTime}h00
                      </label>
                      <input
                        type="range"
                        min="6"
                        max="18"
                        step="1"
                        value={sunTime}
                        onChange={(e) => setSunTime(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* Light Intensity Slider */}
                    <div className="mt-2">
                      <label className="block text-sm font-medium mb-1">
                        {t('flights.viewer.light')}: {lightIntensity.toFixed(1)}
                        x
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={lightIntensity}
                        onChange={(e) =>
                          setLightIntensity(Number(e.target.value))
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                </AccordionSection>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cesium Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
