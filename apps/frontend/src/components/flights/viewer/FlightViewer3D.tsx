import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Entity } from 'cesium';
import {
  BoundingSphere,
  Cartesian2,
  CallbackProperty,
  Cartesian3,
  Cartographic,
  Color,
  ConstantPositionProperty,
  HeadingPitchRange,
  HorizontalOrigin,
  ImageMaterialProperty,
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
import { useFlightGPX } from '../../../hooks/flights/useFlightGPX';
import { useFlight } from '../../../hooks/flights/useFlight';
import {
  getHeadingFromOrientation,
  getOrientationLabel,
  getOrientationOptions,
} from '../../../utils/cameraOrientation';
import {
  DEFAULT_CAMERA_CLOSE_ZOOM_PERCENT,
  DEFAULT_CAMERA_TRANSITION_PERCENT,
  getFlightCameraDistance,
} from '../../../utils/cameraDistanceProfile';
import { getExportFrameTarget } from '../../../utils/videoExportFrame';
import { api } from '../../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../hooks/useToast';
import { Button } from '@dashboard-parapente/design-system';
import { Disclosure, DisclosurePanel } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import type { GPXData } from '@dashboard-parapente/shared-types';
import type { Flight } from '@dashboard-parapente/shared-types';
import {
  computeCursorTelemetryLabel,
  type ViewerUnits,
} from './flightViewerTelemetry';
import {
  getBearingRadians,
  getRenderedTrackElevation,
} from './flightViewerTrackPlacement';
import { useAppSettingsStore } from '../../../stores/appSettingsStore';

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
      ratio: number;
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
  exportOnly?: boolean;
  exportJobId?: string | null;
  exportToken?: string | null;
}

interface ScenePositionState {
  position: Cartesian3;
  previousIndex: number;
  nextIndex: number;
  ratio: number;
  timestamp: number;
}

const interpolatePosition = (
  start: Cartesian3,
  end: Cartesian3,
  ratio: number
) =>
  new Cartesian3(
    start.x + (end.x - start.x) * ratio,
    start.y + (end.y - start.y) * ratio,
    start.z + (end.z - start.z) * ratio
  );

const getViewerScene = (viewer: CesiumViewer | null | undefined) => {
  try {
    if (!viewer || viewer.isDestroyed()) {
      return null;
    }

    return viewer.scene ?? null;
  } catch {
    return null;
  }
};

const hasActiveViewerScene = (viewer: CesiumViewer | null | undefined) =>
  Boolean(getViewerScene(viewer));

const destroyViewer = (viewer: CesiumViewer) => {
  try {
    viewer.useDefaultRenderLoop = false;
    viewer.clock.shouldAnimate = false;
  } catch {
    // Cesium can invalidate internals while tearing down the WebGL context.
  }

  try {
    if (!viewer.isDestroyed()) {
      viewer.destroy();
    }
  } catch {
    // Avoid surfacing late Cesium teardown errors during route transitions.
  }
};

const renderViewerFrame = (viewer: CesiumViewer) => {
  const scene = getViewerScene(viewer);
  if (!scene) return;

  try {
    scene.requestRender();
    viewer.render();
  } catch {
    // Ignore late render calls while Cesium is tearing down between flights.
  }
};

const MIN_TRACK_SEGMENT_DISTANCE_SQUARED = 0.01;
const REPLAY_TRACK_ALTITUDE_OFFSET_METERS = 0;

const createReplayTrackCurtainImage = () => {
  if (typeof document === 'undefined') return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(255, 90, 31, 0.34)');
  gradient.addColorStop(0.45, 'rgba(255, 145, 77, 0.16)');
  gradient.addColorStop(1, 'rgba(255, 90, 31, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL();
};

const liftTrackPosition = (position: Cartesian3) => {
  const cartographic = Cartographic.fromCartesian(position);
  return Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    cartographic.height + REPLAY_TRACK_ALTITUDE_OFFSET_METERS
  );
};

const getRenderableTrackPositions = (positions: Cartesian3[]) =>
  positions.reduce<Cartesian3[]>((uniquePositions, rawPosition) => {
    const position = liftTrackPosition(rawPosition);
    const previousPosition = uniquePositions[uniquePositions.length - 1];
    if (
      !previousPosition ||
      Cartesian3.distanceSquared(previousPosition, position) >
        MIN_TRACK_SEGMENT_DISTANCE_SQUARED
    ) {
      uniquePositions.push(position);
    }

    return uniquePositions;
  }, []);

const getTrackCurtainMinimumHeights = (
  positions: Cartesian3[],
  viewer: CesiumViewer
) =>
  positions.map((position) => {
    const cartographic = Cartographic.fromCartesian(position);
    const scene = getViewerScene(viewer);
    const fallbackHeight = cartographic.height - 120;
    const terrainHeight = scene?.globe.getHeight(cartographic);

    return Math.min(cartographic.height - 1, terrainHeight ?? fallbackHeight);
  });

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
              style={{
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
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
  exportOnly = false,
  exportJobId,
  exportToken,
}) => {
  const { t } = useTranslation();
  const resolvedFlightTitle = flightTitle || t('flights.viewer.defaultTitle');
  const {
    data: gpxData,
    isLoading,
    error,
  } = useFlightGPX(flightId, {
    exportJobId,
    exportToken,
  });
  const { data: flight } = useFlight(flightId, { exportJobId, exportToken });
  const queryClient = useQueryClient();
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const isMountedRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(10);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [terrainReady, setTerrainReady] = useState(false);
  const [elevationOffset, setElevationOffset] = useState(0);
  const [autoOffset, setAutoOffset] = useState(0);
  const [landingElevationOffset, setLandingElevationOffset] = useState<
    number | null
  >(null);
  const [isCalculatingOffset, setIsCalculatingOffset] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(compact);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);
  const appUnits = useAppSettingsStore((state) => state.settings.units);
  const viewerUnits: ViewerUnits = useMemo(
    () => ({
      altitude: appUnits.altitude,
      speed: appUnits.speed,
    }),
    [appUnits.altitude, appUnits.speed]
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
  const [tempCameraCloseZoomPercent, setTempCameraCloseZoomPercent] =
    useState<number>(DEFAULT_CAMERA_CLOSE_ZOOM_PERCENT);
  const [tempCameraTransitionPercent, setTempCameraTransitionPercent] =
    useState<number>(DEFAULT_CAMERA_TRANSITION_PERCENT);

  const allPositionsRef = useRef<Cartesian3[]>([]);
  const timestampsRef = useRef<number[]>([]);
  const currentIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(10);
  const realTimeStartRef = useRef<number>(0);
  const gpxStartTimeRef = useRef<number>(0);

  const trackEntityRef = useRef<Entity | null>(null);
  const trackCurtainEntityRef = useRef<Entity | null>(null);
  const trackPositionCountRef = useRef(0);
  const cursorEntityRef = useRef<Entity | null>(null);
  const startEntityRef = useRef<Entity | null>(null);
  const visiblePositionsRef = useRef<Cartesian3[]>([]);
  const cursorPositionPropertyRef = useRef<ConstantPositionProperty | null>(
    null
  );
  const animationFrameRef = useRef<number | null>(null);
  const cameraHeadingRef = useRef<number>(0);
  const cameraDistanceRef = useRef<number>(500);
  const cameraCloseZoomPercentRef = useRef<number>(
    DEFAULT_CAMERA_CLOSE_ZOOM_PERCENT
  );
  const cameraTransitionPercentRef = useRef<number>(
    DEFAULT_CAMERA_TRANSITION_PERCENT
  );
  const cameraTargetRef = useRef<Cartesian3 | null>(null);
  const currentTimestampRef = useRef<number | null>(null);
  const containerDivRef = useRef<HTMLDivElement>(null);
  const viewerUnitsRef = useRef<ViewerUnits>(viewerUnits);
  const delayedPlaybackTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const cameraApplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const clearDelayedPlayback = useCallback(() => {
    if (delayedPlaybackTimeoutRef.current) {
      clearTimeout(delayedPlaybackTimeoutRef.current);
      delayedPlaybackTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (delayedPlaybackTimeoutRef.current) {
        clearTimeout(delayedPlaybackTimeoutRef.current);
        delayedPlaybackTimeoutRef.current = null;
      }
      if (cameraApplyTimeoutRef.current) {
        clearTimeout(cameraApplyTimeoutRef.current);
        cameraApplyTimeoutRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window._setExportFrame = undefined;
        window._getExportMetadata = undefined;
        window._gpxData = undefined;
        window._cesiumViewer = undefined;
      }
    };
  }, []);

  const isActiveViewer = useCallback((viewer: CesiumViewer) => {
    return viewerRef.current === viewer && hasActiveViewerScene(viewer);
  }, []);

  const removeTrackEntity = useCallback((viewer: CesiumViewer) => {
    if (!getViewerScene(viewer)) {
      trackEntityRef.current = null;
      trackCurtainEntityRef.current = null;
      trackPositionCountRef.current = 0;
      return;
    }

    if (
      trackEntityRef.current &&
      viewer.entities.contains(trackEntityRef.current)
    ) {
      viewer.entities.remove(trackEntityRef.current);
    }
    if (
      trackCurtainEntityRef.current &&
      viewer.entities.contains(trackCurtainEntityRef.current)
    ) {
      viewer.entities.remove(trackCurtainEntityRef.current);
    }
    trackEntityRef.current = null;
    trackCurtainEntityRef.current = null;
    trackPositionCountRef.current = 0;
  }, []);

  const syncTrackEntity = useCallback(
    (viewer: CesiumViewer) => {
      if (!isActiveViewer(viewer)) return;

      const renderablePositions = getRenderableTrackPositions(
        visiblePositionsRef.current
      );

      if (renderablePositions.length < 2) {
        removeTrackEntity(viewer);
        return;
      }

      if (
        !trackCurtainEntityRef.current ||
        !viewer.entities.contains(trackCurtainEntityRef.current)
      ) {
        const curtainImage = createReplayTrackCurtainImage();

        trackCurtainEntityRef.current = viewer.entities.add({
          wall: {
            positions: new CallbackProperty(
              () =>
                isActiveViewer(viewer)
                  ? getRenderableTrackPositions(visiblePositionsRef.current)
                  : [],
              false
            ),
            minimumHeights: new CallbackProperty(
              () =>
                isActiveViewer(viewer)
                  ? getTrackCurtainMinimumHeights(
                      getRenderableTrackPositions(visiblePositionsRef.current),
                      viewer
                    )
                  : [],
              false
            ),
            material: curtainImage
              ? new ImageMaterialProperty({
                  image: curtainImage,
                  transparent: true,
                })
              : Color.fromCssColorString('#ff5a1f').withAlpha(0.16),
            shadows: ShadowMode.DISABLED,
          },
        });
      }

      trackPositionCountRef.current = renderablePositions.length;
    },
    [isActiveViewer, removeTrackEntity]
  );

  useEffect(() => {
    viewerUnitsRef.current = viewerUnits;

    const scene = getViewerScene(viewerRef.current);
    if (scene) {
      scene.requestRender();
    }
  }, [viewerUnits]);

  // Initialize Cesium Viewer
  useEffect(() => {
    let isMounted = true;
    let attemptCount = 0;
    const maxAttempts = 10;
    let createViewerTimeout: ReturnType<typeof setTimeout> | null = null;

    const tryCreateViewer = () => {
      attemptCount++;

      if (!isMounted || !isMountedRef.current) return;

      if (!containerRef.current) {
        if (attemptCount < maxAttempts) {
          createViewerTimeout = setTimeout(tryCreateViewer, 100);
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
          geocoder: false,
          homeButton: false,
          fullscreenButton: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          vrButton: false,
          infoBox: false,
          selectionIndicator: false,
        });

        const scene = getViewerScene(viewer);
        if (!scene) {
          destroyViewer(viewer);
          setViewerError('Cesium scene could not be initialized');
          return;
        }

        // Enable terrain collision detection
        scene.screenSpaceCameraController.enableCollisionDetection = true;

        viewerRef.current = viewer;
        setViewerError(null);
        setViewerReady(true);
      } catch (error) {
        if (!isMounted || !isMountedRef.current) return;
        const errorMsg = error instanceof Error ? error.message : String(error);
        setViewerError(errorMsg);
      }
    };

    // Start trying to create viewer after a small delay
    createViewerTimeout = setTimeout(tryCreateViewer, 100);

    return () => {
      isMounted = false;
      if (createViewerTimeout) {
        clearTimeout(createViewerTimeout);
      }
      const viewer = viewerRef.current;
      viewerRef.current = null;
      if (viewer) {
        destroyViewer(viewer);
      }
      if (typeof window !== 'undefined') {
        window._setExportFrame = undefined;
        window._getExportMetadata = undefined;
        window._gpxData = undefined;
        window._cesiumViewer = undefined;
      }
      if (isMountedRef.current) {
        setViewerReady(false);
      }
    };
  }, []);

  // Monitor terrain loading status
  useEffect(() => {
    const viewer = viewerRef.current;
    const scene = getViewerScene(viewer);
    if (!viewer || !scene || !viewerReady) return;

    // Reset terrain ready when checking
    setTerrainReady(false);

    // Check if terrain is already loaded
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkTerrainReady = () => {
      const currentScene = getViewerScene(viewer);
      if (!isMounted || viewerRef.current !== viewer || !currentScene) return;

      // Check if tiles are loaded in the current view
      const tilesLoaded = currentScene.globe.tilesLoaded;

      if (tilesLoaded) {
        setTerrainReady(true);
      } else {
        // Check again after a short delay
        timeoutId = setTimeout(checkTerrainReady, 500);
      }
    };

    // Start checking after a small delay
    timeoutId = setTimeout(checkTerrainReady, 1000);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [viewerReady, flightId]);

  // Réinitialiser les offsets quand on change de vol
  useEffect(() => {
    setElevationOffset(0);
    setAutoOffset(0);
    setLandingElevationOffset(null);
    setTerrainReady(false); // Reset terrain ready state on flight change
  }, [flightId]);

  // Configure terrain rendering (shadows, AO, lighting)
  useEffect(() => {
    const viewer = viewerRef.current;
    const scene = getViewerScene(viewer);
    if (!viewer || !scene || !viewerReady) return;

    try {
      // 1. Terrain shadows
      viewer.shadows = terrainShadows;
      viewer.terrainShadows = terrainShadows
        ? ShadowMode.ENABLED
        : ShadowMode.DISABLED;

      // 2. Ambient Occlusion
      const aoStage = scene.postProcessStages.ambientOcclusion;
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
      if (scene.light) {
        scene.light.intensity = lightIntensity;
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

    const viewer = viewerRef.current;
    if (!viewer || !isActiveViewer(viewer)) {
      return;
    }

    const cameraTimers: ReturnType<typeof setTimeout>[] = [];
    let isEffectActive = true;

    try {
      // Convert GPX coordinates to Cartesian3 avec offset d'élévation
      const positions = gpxData.coordinates.map((point, index) =>
        Cartesian3.fromDegrees(
          point.lon,
          point.lat,
          getRenderedTrackElevation(
            point,
            index,
            gpxData.coordinates.length,
            elevationOffset,
            landingElevationOffset
          )
        )
      );

      const timestamps = gpxData.coordinates.map((coord) => coord.timestamp);

      allPositionsRef.current = positions;
      timestampsRef.current = timestamps;
      currentIndexRef.current = 0;
      currentTimestampRef.current = null;
      cameraTargetRef.current = null;
      visiblePositionsRef.current = [];

      // Expose data globally for video export (Playwright)
      if (typeof window !== 'undefined' && window._exportMode) {
        window._gpxData = {
          ...gpxData,
          positions,
          timestamps,
        };
        window._cesiumViewer = viewer;
      }

      // Clean old entities
      removeTrackEntity(viewer);
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

      viewer.clock.shouldAnimate = false;

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
      const calculateOptimalHeading = (): number => {
        if (gpxData.coordinates.length < 2) return 0;

        const numPoints = gpxData.coordinates.length;

        // Takeoff is at the beginning
        const takeoffCoord = gpxData.coordinates[0];

        // Use middle of the flight (50%) as reference for better perspective
        const referenceIndex = Math.floor(numPoints * 0.5);
        const referenceCoord = gpxData.coordinates[referenceIndex];

        // Calculate heading from reference point BACK to takeoff
        // This makes the camera look toward the takeoff/launch site
        return getBearingRadians(referenceCoord, takeoffCoord);
      };

      // Position camera - MUST happen after elevation offset is calculated
      // Using a very low angle to see the altitude of the flight track
      const positionCamera = () => {
        if (
          !isEffectActive ||
          !isMountedRef.current ||
          !isActiveViewer(viewer)
        ) {
          return;
        }

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
        } else {
          // Calculate optimal heading automatically
          heading = calculateOptimalHeading();
          distance = boundingSphere.radius * 0.8;
        }

        cameraHeadingRef.current = heading;
        cameraDistanceRef.current = distance;

        viewer.camera.flyToBoundingSphere(boundingSphere, {
          duration: 2,
          offset: new HeadingPitchRange(
            heading, // heading perpendicular to flight direction
            -0.05, // pitch: légèrement incliné vers le bas pour voir le sol
            distance // distance plus proche pour meilleure immersion
          ),
        });
      };

      // Position immédiate
      cameraTimers.push(setTimeout(() => positionCamera(), 500));
      // Re-position après calcul de l'offset (1.5s + 500ms)
      cameraTimers.push(setTimeout(() => positionCamera(), 2500));
    } catch (err) {
      console.error('Error loading GPX data:', err);
    }

    return () => {
      isEffectActive = false;
      clearDelayedPlayback();
      for (const timer of cameraTimers) {
        clearTimeout(timer);
      }

      // Reset play state when changing flights
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      isPlayingRef.current = false;
      setIsPlaying(false);
      currentIndexRef.current = 0;
      setCurrentProgress(0);

      if (typeof window !== 'undefined' && window._cesiumViewer === viewer) {
        window._cesiumViewer = undefined;
        window._gpxData = undefined;
      }

      const currentViewer = viewerRef.current;
      if (!currentViewer || !isActiveViewer(currentViewer)) return;

      try {
        removeTrackEntity(currentViewer);
        if (
          cursorEntityRef.current &&
          currentViewer.entities.contains(cursorEntityRef.current)
        ) {
          currentViewer.entities.remove(cursorEntityRef.current);
        }
        if (
          startEntityRef.current &&
          currentViewer.entities.contains(startEntityRef.current)
        ) {
          currentViewer.entities.remove(startEntityRef.current);
        }
      } catch (e) {
        console.debug('Cleanup warning:', e);
      }

      cursorEntityRef.current = null;
      startEntityRef.current = null;
      isPlayingRef.current = false;
      currentIndexRef.current = 0;
      visiblePositionsRef.current = [];
    };
    // Intentionally exclude site camera fields to avoid replay reset after save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clearDelayedPlayback,
    elevationOffset,
    gpxData,
    isActiveViewer,
    landingElevationOffset,
    viewerReady,
  ]);

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
      setTempCameraCloseZoomPercent(
        flight.site.camera_close_zoom_percent ||
          DEFAULT_CAMERA_CLOSE_ZOOM_PERCENT
      );
      setTempCameraTransitionPercent(
        flight.site.camera_transition_percent ||
          DEFAULT_CAMERA_TRANSITION_PERCENT
      );
      cameraCloseZoomPercentRef.current =
        flight.site.camera_close_zoom_percent ||
        DEFAULT_CAMERA_CLOSE_ZOOM_PERCENT;
      cameraTransitionPercentRef.current =
        flight.site.camera_transition_percent ||
        DEFAULT_CAMERA_TRANSITION_PERCENT;
    }
  }, [flight?.site]);

  // Position camera based on site orientation
  useEffect(() => {
    const viewer = viewerRef.current;
    if (
      !viewer ||
      !getViewerScene(viewer) ||
      !viewerReady ||
      !gpxData?.coordinates?.length ||
      !allPositionsRef.current.length
    ) {
      return;
    }

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
    const cameraCloseZoomPercent =
      flight?.site?.camera_close_zoom_percent ||
      DEFAULT_CAMERA_CLOSE_ZOOM_PERCENT;
    const cameraTransitionPercent =
      flight?.site?.camera_transition_percent ||
      DEFAULT_CAMERA_TRANSITION_PERCENT;

    if (cameraAngle !== null && cameraAngle !== undefined) {
      // Camera is positioned at the specified angle, looking back at takeoff
      // The camera heading should be OPPOSITE to the camera angle
      const oppositeHeading = (cameraAngle + 180) % 360;

      // Save camera settings for replay mode
      cameraHeadingRef.current = CesiumMath.toRadians(cameraAngle);
      cameraDistanceRef.current = cameraDistance;
      cameraCloseZoomPercentRef.current = cameraCloseZoomPercent;
      cameraTransitionPercentRef.current = cameraTransitionPercent;

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
    flight?.site?.camera_close_zoom_percent,
    flight?.site?.camera_transition_percent,
    flight?.site?.orientation,
  ]);

  // Calculer automatiquement l'offset d'élévation
  const calculateAutoElevationOffset = useCallback(async () => {
    const viewer = viewerRef.current;
    if (!viewer || !isActiveViewer(viewer) || !gpxData?.coordinates?.[0]) {
      return;
    }

    setIsCalculatingOffset(true);

    try {
      const firstPoint = gpxData.coordinates[0];
      const lastPoint = gpxData.coordinates[gpxData.coordinates.length - 1];

      // Créer une position cartographique pour le premier point
      const firstPosition = Cartesian3.fromDegrees(
        firstPoint.lon,
        firstPoint.lat
      );
      const firstCartographic = Cartographic.fromCartesian(firstPosition);
      const lastPosition = Cartesian3.fromDegrees(lastPoint.lon, lastPoint.lat);
      const lastCartographic = Cartographic.fromCartesian(lastPosition);

      // Échantillonner le terrain pour obtenir la hauteur réelle du sol
      const terrainProvider = viewer.terrainProvider;
      const samples = await sampleTerrainMostDetailed(terrainProvider, [
        firstCartographic,
        lastCartographic,
      ]);

      if (!isMountedRef.current || !isActiveViewer(viewer)) {
        return;
      }

      if (samples && samples.length > 0 && samples[0].height !== undefined) {
        const terrainHeight = samples[0].height;
        const gpsElevation = firstPoint.elevation;

        // Calculer l'offset nécessaire pour que le pilote soit au-dessus du terrain
        // Si terrain = 1000m et GPS = 800m, offset = 1000 - 800 = +200m (on monte le pilote)
        // Si terrain = 1000m et GPS = 1200m, offset = 1000 - 1200 = -200m (on descend le pilote)
        const offset = terrainHeight - gpsElevation;

        setAutoOffset(offset);
        setElevationOffset(offset);
        const landingTerrainHeight = samples[1]?.height;
        if (landingTerrainHeight === undefined) {
          setLandingElevationOffset(null);
        } else {
          setLandingElevationOffset(landingTerrainHeight - lastPoint.elevation);
        }
        // Le flyTo se fera automatiquement via le useEffect qui dépend de elevationOffset
      }
    } catch (error) {
      console.error("Erreur lors du calcul de l'offset d'élévation:", error);
    } finally {
      if (isMountedRef.current && isActiveViewer(viewer)) {
        setIsCalculatingOffset(false);
      }
    }
  }, [gpxData, isActiveViewer]);

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
  let viewerHeight = '600px';
  if (exportOnly || isFullscreen) {
    viewerHeight = '100%';
  } else if (compact) {
    viewerHeight = '420px';
  }
  const rootClassName = exportOnly
    ? 'flight-viewer-export-only absolute inset-0 h-full w-full overflow-hidden bg-black'
    : 'relative w-full overflow-hidden bg-gray-900';

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

  const getScenePositionFromTimestamp = useCallback(
    (targetTimestamp: number): ScenePositionState | null => {
      const positions = allPositionsRef.current;
      const timestamps = timestampsRef.current;
      const lastIndex = positions.length - 1;
      if (lastIndex < 0) {
        return null;
      }

      if (timestamps.length !== positions.length || timestamps.length < 2) {
        const safeIndex = Math.min(
          Math.max(currentIndexRef.current, 0),
          lastIndex
        );
        return {
          position: positions[safeIndex],
          previousIndex: safeIndex,
          nextIndex: safeIndex,
          ratio: 0,
          timestamp: timestamps[safeIndex] ?? 0,
        };
      }

      if (targetTimestamp <= timestamps[0]) {
        return {
          position: positions[0],
          previousIndex: 0,
          nextIndex: 0,
          ratio: 0,
          timestamp: timestamps[0],
        };
      }

      if (targetTimestamp >= timestamps[lastIndex]) {
        return {
          position: positions[lastIndex],
          previousIndex: lastIndex,
          nextIndex: lastIndex,
          ratio: 0,
          timestamp: timestamps[lastIndex],
        };
      }

      let nextIndex = Math.max(currentIndexRef.current + 1, 1);
      if (timestamps[nextIndex] < targetTimestamp) {
        while (
          nextIndex < timestamps.length - 1 &&
          timestamps[nextIndex] < targetTimestamp
        ) {
          nextIndex += 1;
        }
      } else {
        while (nextIndex > 1 && timestamps[nextIndex - 1] > targetTimestamp) {
          nextIndex -= 1;
        }
      }

      const previousIndex = nextIndex - 1;
      const previousTimestamp = timestamps[previousIndex];
      const nextTimestamp = timestamps[nextIndex];
      const segmentDuration = nextTimestamp - previousTimestamp;
      const ratio =
        segmentDuration > 0
          ? Math.min(
              Math.max(
                (targetTimestamp - previousTimestamp) / segmentDuration,
                0
              ),
              1
            )
          : 0;

      return {
        position: interpolatePosition(
          positions[previousIndex],
          positions[nextIndex],
          ratio
        ),
        previousIndex,
        nextIndex,
        ratio,
        timestamp: targetTimestamp,
      };
    },
    []
  );

  const getScenePositionFromProgress = useCallback(
    (targetProgress: number): ScenePositionState | null => {
      const positions = allPositionsRef.current;
      const lastIndex = positions.length - 1;
      if (lastIndex < 0) {
        return null;
      }

      const progress = Math.min(Math.max(targetProgress, 0), 1);
      const timestamps = timestampsRef.current;
      if (timestamps.length === positions.length && timestamps.length > 1) {
        const startTimestamp = timestamps[0];
        const endTimestamp = timestamps[timestamps.length - 1];
        const durationMs = endTimestamp - startTimestamp;

        if (durationMs > 0) {
          return getScenePositionFromTimestamp(
            startTimestamp + durationMs * progress
          );
        }
      }

      const exactIndex = progress * lastIndex;
      const previousIndex = Math.floor(exactIndex);
      const nextIndex = Math.ceil(exactIndex);
      const ratio = exactIndex - previousIndex;

      return {
        position: interpolatePosition(
          positions[previousIndex],
          positions[nextIndex],
          ratio
        ),
        previousIndex,
        nextIndex,
        ratio,
        timestamp: timestamps[previousIndex] ?? 0,
      };
    },
    [getScenePositionFromTimestamp]
  );

  const applyScenePosition = useCallback(
    (scenePosition: ScenePositionState, smoothCamera: boolean) => {
      const lastIndex = allPositionsRef.current.length - 1;
      if (lastIndex < 0) {
        return { index: 0, progress: 0, ratio: 0, tilesLoaded: false };
      }

      currentIndexRef.current =
        scenePosition.ratio >= 0.5
          ? scenePosition.nextIndex
          : scenePosition.previousIndex;
      currentTimestampRef.current = scenePosition.timestamp;
      visiblePositionsRef.current = allPositionsRef.current.slice(
        0,
        scenePosition.previousIndex + 1
      );
      if (scenePosition.ratio > 0) {
        visiblePositionsRef.current = [
          ...visiblePositionsRef.current,
          scenePosition.position,
        ];
      }

      if (timestampsRef.current.length > 0) {
        const startTimestamp = timestampsRef.current[0];
        setCurrentElapsedTime(
          (scenePosition.timestamp - startTimestamp) / 1000
        );
      }

      if (cursorPositionPropertyRef.current) {
        cursorPositionPropertyRef.current.setValue(scenePosition.position);
      }

      const viewer = viewerRef.current;
      const scene = getViewerScene(viewer);
      if (viewer && scene) {
        const heading = cameraHeadingRef.current;
        const progress =
          lastIndex > 0
            ? (scenePosition.previousIndex + scenePosition.ratio) / lastIndex
            : 0;
        const isExportMode =
          typeof window !== 'undefined' && Boolean(window._exportMode);
        const distance = isExportMode
          ? cameraDistanceRef.current
          : getFlightCameraDistance({
              progress,
              baseDistance: cameraDistanceRef.current,
              closeZoomPercent: cameraCloseZoomPercentRef.current,
              transitionPercent: cameraTransitionPercentRef.current,
            });
        const pitch = -0.05;

        if (!smoothCamera || !cameraTargetRef.current) {
          cameraTargetRef.current = scenePosition.position;
        } else {
          const lerpFactor = 0.08;
          cameraTargetRef.current = interpolatePosition(
            cameraTargetRef.current,
            scenePosition.position,
            lerpFactor
          );
        }

        viewer.camera.setView({
          destination: cameraTargetRef.current,
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
        const globe = scene.globe;
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

        syncTrackEntity(viewer);
        renderViewerFrame(viewer);
      }

      let progress = 0;
      if (timestampsRef.current.length > 1) {
        progress =
          ((scenePosition.timestamp - timestampsRef.current[0]) /
            Math.max(
              timestampsRef.current[timestampsRef.current.length - 1] -
                timestampsRef.current[0],
              1
            )) *
          100;
      } else if (lastIndex > 0) {
        progress =
          ((scenePosition.previousIndex + scenePosition.ratio) / lastIndex) *
          100;
      }
      const safeProgress = Math.min(Math.max(progress, 0), 100);
      setCurrentProgress(safeProgress);

      return {
        index: currentIndexRef.current,
        progress: safeProgress,
        ratio: scenePosition.ratio,
        tilesLoaded: Boolean(getViewerScene(viewer)?.globe.tilesLoaded),
      };
    },
    [syncTrackEntity]
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !window._exportMode ||
      !viewerReady ||
      !gpxData?.coordinates?.length ||
      allPositionsRef.current.length === 0
    ) {
      return;
    }

    window._setExportFrame = (frameIndex: number, totalFrames: number) => {
      const target = getExportFrameTarget(
        frameIndex,
        totalFrames,
        allPositionsRef.current.length
      );
      const scenePosition = getScenePositionFromProgress(target.progress);

      if (!scenePosition) {
        return { index: 0, progress: 0, ratio: 0, tilesLoaded: false };
      }

      return applyScenePosition(scenePosition, false);
    };

    window._getExportMetadata = () => ({
      totalPoints: allPositionsRef.current.length,
      duration:
        gpxData?.flight_duration_seconds ||
        allPositionsRef.current.length ||
        300,
    });

    return () => {
      window._setExportFrame = undefined;
      window._getExportMetadata = undefined;
    };
  }, [
    gpxData?.coordinates?.length,
    gpxData?.flight_duration_seconds,
    applyScenePosition,
    getScenePositionFromProgress,
    viewerReady,
  ]);

  const play = useCallback(() => {
    if (animationFrameRef.current || allPositionsRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);

    realTimeStartRef.current = performance.now();
    gpxStartTimeRef.current =
      currentTimestampRef.current ??
      timestampsRef.current[currentIndexRef.current] ??
      timestampsRef.current[0] ??
      0;

    const step = (now: number) => {
      const lastTimestamp =
        timestampsRef.current[timestampsRef.current.length - 1];
      if (!isPlayingRef.current || gpxStartTimeRef.current >= lastTimestamp) {
        animationFrameRef.current = null;
        isPlayingRef.current = false;
        setIsPlaying(false);
        return;
      }

      const speed = speedRef.current;
      const elapsedRealTime = now - realTimeStartRef.current;
      const elapsedGpxTime = elapsedRealTime * speed;
      const targetGpxTime = gpxStartTimeRef.current + elapsedGpxTime;
      const scenePosition = getScenePositionFromTimestamp(targetGpxTime);

      if (!scenePosition || scenePosition.timestamp >= lastTimestamp) {
        const endPosition = getScenePositionFromProgress(1);
        if (endPosition) {
          applyScenePosition(endPosition, true);
        }
        animationFrameRef.current = null;
        isPlayingRef.current = false;
        setIsPlaying(false);
        return;
      }

      applyScenePosition(scenePosition, true);
      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, [
    applyScenePosition,
    getScenePositionFromProgress,
    getScenePositionFromTimestamp,
  ]);

  const pause = useCallback(() => {
    clearDelayedPlayback();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, [clearDelayedPlayback]);

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
    currentTimestampRef.current = null;
    cameraTargetRef.current = null;
    setCurrentProgress(0);
    setCurrentElapsedTime(0);

    if (allPositionsRef.current.length > 0) {
      visiblePositionsRef.current = [];

      if (cursorPositionPropertyRef.current) {
        cursorPositionPropertyRef.current.setValue(allPositionsRef.current[0]);
      }

      const viewer = viewerRef.current;
      const scene = getViewerScene(viewer);
      if (viewer && scene) {
        removeTrackEntity(viewer);
        scene.requestRender();
      }
    }
  }, [pause, removeTrackEntity]);

  const handleProgressChange = useCallback(
    (value: number) => {
      const wasPlaying = isPlayingRef.current;

      // Pause si en lecture
      if (wasPlaying) {
        pause();
      }

      const scenePosition = getScenePositionFromProgress(value / 100);
      if (scenePosition) {
        applyScenePosition(scenePosition, false);
      }

      // Reprendre la lecture si elle était active
      if (wasPlaying) {
        clearDelayedPlayback();
        delayedPlaybackTimeoutRef.current = setTimeout(() => {
          delayedPlaybackTimeoutRef.current = null;
          if (isMountedRef.current) {
            play();
          }
        }, 50);
      }
    },
    [
      applyScenePosition,
      clearDelayedPlayback,
      getScenePositionFromProgress,
      pause,
      play,
    ]
  );

  const handleSpeedChange = (value: number) => {
    setReplaySpeed(value);
    speedRef.current = value;

    if (isPlayingRef.current) {
      pause();
      clearDelayedPlayback();
      delayedPlaybackTimeoutRef.current = setTimeout(() => {
        delayedPlaybackTimeoutRef.current = null;
        if (isMountedRef.current) {
          play();
        }
      }, 50);
    }
  };

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
    distance: number,
    closeZoomPercent: number,
    transitionPercent: number
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
      params.append('close_zoom_percent', closeZoomPercent.toString());
      params.append('transition_percent', transitionPercent.toString());

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
              camera_close_zoom_percent: closeZoomPercent,
              camera_transition_percent: transitionPercent,
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
  const repositionCamera = useCallback(
    (angle: number, distance: number) => {
      const viewer = viewerRef.current;
      if (
        !viewer ||
        !isActiveViewer(viewer) ||
        !allPositionsRef.current.length
      ) {
        return;
      }

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
    },
    [isActiveViewer]
  );

  const applyCameraToCurrentPlayback = (showToast = true) => {
    if (!allPositionsRef.current.length) {
      toast.info(t('flights.viewer.noTrackForCamera'));
      return;
    }

    cameraCloseZoomPercentRef.current = tempCameraCloseZoomPercent;
    cameraTransitionPercentRef.current = tempCameraTransitionPercent;
    repositionCamera(tempCameraAngle, tempCameraDistance);
    if (showToast) {
      toast.success(t('flights.viewer.cameraAppliedToPlayback'));
    }
  };

  const saveCameraSettings = async () => {
    const saved = await updateCameraSettings(
      tempCameraAngle,
      tempCameraDistance,
      tempCameraCloseZoomPercent,
      tempCameraTransitionPercent
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
    if (cameraApplyTimeoutRef.current) {
      clearTimeout(cameraApplyTimeoutRef.current);
    }
    cameraApplyTimeoutRef.current = setTimeout(() => {
      cameraApplyTimeoutRef.current = null;
      if (isMountedRef.current) {
        applyCameraToCurrentPlayback(false);
      }
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
      className={rootClassName}
      style={{ height: viewerHeight }}
      data-testid="flight-viewer-root"
    >
      {exportOnly && (
        <style>{`
          .flight-viewer-export-only .cesium-viewer,
          .flight-viewer-export-only .cesium-widget,
          .flight-viewer-export-only .cesium-widget canvas {
            width: 100% !important;
            height: 100% !important;
          }

          .flight-viewer-export-only .cesium-viewer-toolbar,
          .flight-viewer-export-only .cesium-viewer-animationContainer,
          .flight-viewer-export-only .cesium-viewer-timelineContainer,
          .flight-viewer-export-only .cesium-viewer-fullscreenContainer,
          .flight-viewer-export-only .cesium-infoBox,
          .flight-viewer-export-only .cesium-selection-wrapper {
            display: none !important;
          }
        `}</style>
      )}
      {/* Overlay for loading/error states */}
      {renderOverlay()}

      {/* Bouton plein écran */}
      {gpxData?.coordinates && !exportOnly && (
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
      {gpxData?.coordinates && !exportOnly && (
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

                {/* ========== SECTION 2: SITE & CAMÉRA ========== */}
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

                      <div className="mb-2">
                        <label
                          htmlFor="camera-close-zoom-slider"
                          className="block text-xs text-gray-600 dark:text-gray-300 mb-1"
                        >
                          {t('editSite.closeZoom')}:{' '}
                          {tempCameraCloseZoomPercent}%
                        </label>
                        <input
                          id="camera-close-zoom-slider"
                          type="range"
                          min="30"
                          max="100"
                          step="5"
                          value={tempCameraCloseZoomPercent}
                          onChange={(e) =>
                            setTempCameraCloseZoomPercent(
                              Number(e.target.value)
                            )
                          }
                          className="w-full"
                          data-testid="camera-close-zoom-slider"
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>30%</span>
                          <span>100%</span>
                        </div>
                      </div>

                      <div className="mb-2">
                        <label
                          htmlFor="camera-transition-slider"
                          className="block text-xs text-gray-600 dark:text-gray-300 mb-1"
                        >
                          {t('editSite.transition')}:{' '}
                          {tempCameraTransitionPercent}%
                        </label>
                        <input
                          id="camera-transition-slider"
                          type="range"
                          min="1"
                          max="40"
                          step="1"
                          value={tempCameraTransitionPercent}
                          onChange={(e) =>
                            setTempCameraTransitionPercent(
                              Number(e.target.value)
                            )
                          }
                          className="w-full"
                          data-testid="camera-transition-slider"
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>1%</span>
                          <span>40%</span>
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
                          isDisabled={isUpdatingCamera}
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
                        isDisabled={isCalculatingOffset}
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
      <div
        ref={containerRef}
        className={
          exportOnly ? 'absolute inset-0 h-full w-full' : 'h-full w-full'
        }
      />
    </div>
  );
};
