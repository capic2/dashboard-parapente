import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  Terrain,
  Entity,
  CallbackProperty,
  ConstantPositionProperty,
  ArcType,
  BoundingSphere,
  HeadingPitchRange,
  Cartographic,
  sampleTerrainMostDetailed,
  Matrix4,
  SceneTransforms,
  Cartesian2,
  ShadowMode,
  JulianDate,
  Math as CesiumMath,
} from 'cesium';
import { useFlightGPX } from '../hooks/useFlightGPX';
import { useFlight } from '../hooks/useFlight';
import { getHeadingFromOrientation, getOrientationLabel, getOrientationOptions } from '../utils/cameraOrientation';
import { api } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

export interface FlightViewer3DProps {
  flightId: string;
  flightTitle?: string;
}

// API base URL - use environment variable or derive from current location
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8001` : 'http://localhost:8001');

/**
 * FlightViewer3D - 3D flight viewer using Cesium
 */
export const FlightViewer3D: React.FC<FlightViewer3DProps> = ({
  flightId,
  flightTitle = 'Flight View',
}) => {
  const { data: gpxData, isLoading, error } = useFlightGPX(flightId);
  const { data: flight } = useFlight(flightId);
  const queryClient = useQueryClient();
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
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);
  
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
  const exportPollingRef = useRef<NodeJS.Timeout | null>(null);
  const cameraHeadingRef = useRef<number>(0);
  const cameraDistanceRef = useRef<number>(500);
  const cameraTargetRef = useRef<Cartesian3 | null>(null);

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
        console.log('✅ Terrain textures loaded for flight', flightId);
        setTerrainReady(true);
      } else {
        console.log('⏳ Waiting for terrain textures...');
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
      viewer.terrainShadows = terrainShadows ? ShadowMode.ENABLED : ShadowMode.DISABLED;
      
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

      console.log(`🎨 Terrain rendering updated: shadows=${terrainShadows}, AO=${ambientOcclusion}, time=${sunTime}h, intensity=${lightIntensity}x`);
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

      // Debug: Check timestamps
      console.log('🔍 DEBUG FlightViewer3D - Total coordinates:', gpxData.coordinates.length);
      console.log('🔍 DEBUG FlightViewer3D - First 3 RAW coords:', gpxData.coordinates.slice(0, 3));
      console.log('🔍 DEBUG FlightViewer3D - First 3 timestamps:', timestamps.slice(0, 3));
      console.log('🔍 DEBUG FlightViewer3D - Last 3 timestamps:', timestamps.slice(-3));
      console.log('🔍 DEBUG FlightViewer3D - All timestamps zero?', timestamps.every(t => t === 0));

      allPositionsRef.current = positions;
      timestampsRef.current = timestamps;
      currentIndexRef.current = 0;
      visiblePositionsRef.current = [positions[0]];
      
      // Expose data globally for video export (Playwright)
      if (typeof window !== 'undefined' && (window as any)._exportMode) {
        (window as any)._gpxData = {
          coordinates: gpxData.coordinates,
          positions: positions,
          timestamps: timestamps
        };
        (window as any)._cesiumViewer = viewer;
        console.log('🎥 Exposed GPS data and Cesium viewer for export');
        console.log('   - GPS points:', gpxData.coordinates.length);
        console.log('   - Duration:', Math.round((timestamps[timestamps.length-1] - timestamps[0])/1000), 's');
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
        const deltaLat = takeoffCoord.lat - referenceCoord.lat;
        
        // Calculate angle in radians
        // We need to convert lon/lat differences to proper bearing
        // Using standard bearing formula
        const y = Math.sin(deltaLon) * Math.cos(takeoffCoord.lat * Math.PI / 180);
        const x = Math.cos(referenceCoord.lat * Math.PI / 180) * Math.sin(takeoffCoord.lat * Math.PI / 180) -
                  Math.sin(referenceCoord.lat * Math.PI / 180) * Math.cos(takeoffCoord.lat * Math.PI / 180) * Math.cos(deltaLon);
        const headingToTakeoff = Math.atan2(y, x);
        
        console.log(`🛫 Takeoff: ${takeoffCoord.lat.toFixed(4)}°, ${takeoffCoord.lon.toFixed(4)}°`);
        console.log(`📍 Reference (50%): ${referenceCoord.lat.toFixed(4)}°, ${referenceCoord.lon.toFixed(4)}°`);
        console.log(`📷 Camera heading: ${(headingToTakeoff * 180 / Math.PI).toFixed(1)}° (facing takeoff)`);
        console.log(`   Distance: ${Math.sqrt(deltaLat**2 + deltaLon**2).toFixed(4)}° (~${(Math.sqrt(deltaLat**2 + deltaLon**2) * 111).toFixed(1)} km)`);
        
        return headingToTakeoff;
      };

      // Position camera - MUST happen after elevation offset is calculated
      // Using a very low angle to see the altitude of the flight track
      const positionCamera = async () => {
        if (viewer && !viewer.isDestroyed()) {
          // Check if camera settings were already loaded from site (camera_angle/camera_distance)
          // Read directly from flight.site to avoid stale ref values
          const hasSavedCameraSettings = flight?.site?.camera_angle !== null && 
                                          flight?.site?.camera_angle !== undefined;
          
          let heading: number;
          let distance: number;
          
          if (hasSavedCameraSettings) {
            // Read camera settings directly from flight.site
            const cameraAngle = flight!.site!.camera_angle!;
            distance = flight!.site!.camera_distance || 500;
            heading = CesiumMath.toRadians(cameraAngle);
            
            // Also update refs for replay mode
            cameraHeadingRef.current = heading;
            cameraDistanceRef.current = distance;
            
            console.log('📷 Using saved camera settings from DB:', {
              angle: cameraAngle,
              distance: distance,
              headingRad: heading
            });
          } else {
            // Calculate optimal heading automatically
            heading = await calculateOptimalHeading();
            distance = boundingSphere.radius * 0.8;
            cameraHeadingRef.current = heading;
            cameraDistanceRef.current = distance;
            console.log('📷 Using calculated camera settings:', {
              headingRad: heading,
              distance: distance
            });
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
  }, [gpxData, elevationOffset, viewerReady]);

  // Initialize camera settings from flight data
  useEffect(() => {
    if (flight?.site) {
      // Initialize angle from camera_angle or convert orientation to angle
      let initialAngle = flight.site.camera_angle || 0
      if (!flight.site.camera_angle && flight.site.orientation) {
        initialAngle = getHeadingFromOrientation(flight.site.orientation) || 0
      }
      setTempCameraAngle(initialAngle)
      setTempCameraDistance(flight.site.camera_distance || 500)
    }
  }, [flight?.site])

  // Position camera based on site orientation
  useEffect(() => {
    console.log('🎥 Camera positioning useEffect triggered', {
      viewerReady,
      hasGpxData: !!gpxData?.coordinates,
      hasPositions: allPositionsRef.current.length > 0,
      camera_angle: flight?.site?.camera_angle,
      camera_distance: flight?.site?.camera_distance
    })
    
    if (!viewerRef.current || !viewerReady || !gpxData?.coordinates?.length || !allPositionsRef.current.length) {
      console.log('🎥 Camera positioning skipped - waiting for data')
      return
    }

    const viewer = viewerRef.current
    const firstPosition = allPositionsRef.current[0]
    
    if (!firstPosition) return

    // Use camera_angle if set, otherwise fall back to orientation
    let cameraAngle = flight?.site?.camera_angle
    if (cameraAngle === null || cameraAngle === undefined) {
      // Fallback to orientation if no angle set
      const orientation = flight?.site?.orientation
      cameraAngle = getHeadingFromOrientation(orientation) || null
    }
    const cameraDistance = flight?.site?.camera_distance || 500

    if (cameraAngle !== null && cameraAngle !== undefined) {
      // Camera is positioned at the specified angle, looking back at takeoff
      // The camera heading should be OPPOSITE to the camera angle
      const oppositeHeading = (cameraAngle + 180) % 360;
      
      console.log(`📐 Camera angle: ${cameraAngle}° (position)`)
      console.log(`📏 Camera distance: ${cameraDistance}m`)
      console.log(`📷 Camera looking ${oppositeHeading}° (back at takeoff)`)
      
      // Save camera settings for replay mode
      cameraHeadingRef.current = CesiumMath.toRadians(cameraAngle)
      cameraDistanceRef.current = cameraDistance
      
      // First, position camera at takeoff looking in the OPPOSITE direction
      viewer.camera.setView({
        destination: firstPosition,
        orientation: {
          heading: CesiumMath.toRadians(oppositeHeading),  // Look back at takeoff
          pitch: CesiumMath.toRadians(-10), // Look slightly down
          roll: 0.0
        }
      })
      
      // Then move camera FORWARD by the specified distance
      // This places camera ahead of takeoff, looking back at it
      viewer.camera.moveForward(cameraDistance)
      
      console.log('✅ Camera positioned to face takeoff point')
    } else {
      console.log('📐 No camera angle found, using default camera positioning')
      // Default positioning is already handled by the GPX loading useEffect
    }
  }, [viewerReady, gpxData, flight?.site?.camera_angle, flight?.site?.camera_distance, flight?.site?.orientation])

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
          const currentTimestamp = timestampsRef.current[currentIndexRef.current];
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
          const currentPosition = allPositionsRef.current[currentIndexRef.current];
          const heading = cameraHeadingRef.current;
          const distance = cameraDistanceRef.current;
          const pitch = -0.05;
          
          // Smooth lerp vers la position actuelle
          if (!cameraTargetRef.current) {
            cameraTargetRef.current = currentPosition;
          } else {
            const lerpFactor = 0.08;
            cameraTargetRef.current = new Cartesian3(
              cameraTargetRef.current.x + (currentPosition.x - cameraTargetRef.current.x) * lerpFactor,
              cameraTargetRef.current.y + (currentPosition.y - cameraTargetRef.current.y) * lerpFactor,
              cameraTargetRef.current.z + (currentPosition.z - cameraTargetRef.current.z) * lerpFactor
            );
          }
          
          // Use setView instead of lookAt for better control
          viewer.camera.setView({
            destination: cameraTargetRef.current,
            orientation: {
              heading: heading,
              pitch: pitch,
              roll: 0
            }
          });
          
          // Move camera back by distance
          viewer.camera.moveBackward(distance);
          
          // Check terrain collision and adjust camera height if needed
          const cameraCartographic = Cartographic.fromCartesian(viewer.camera.position);
          const globe = viewer.scene.globe;
          const terrainHeight = globe.getHeight(cameraCartographic);
          
          if (terrainHeight !== undefined && cameraCartographic.height < terrainHeight + 50) {
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

  /**
   * Update site orientation
   */
  const updateOrientation = async (newOrientation: string) => {
    if (!flight?.site?.id) return
    
    setIsUpdatingOrientation(true)
    try {
      await api.patch(`sites/${flight.site.id}/orientation?orientation=${newOrientation}`)
      
      // Refresh flight data to get updated site
      await queryClient.invalidateQueries({ queryKey: ['flights', flightId] })
      
      console.log(`✅ Orientation updated to ${newOrientation}`)
    } catch (error) {
      console.error('❌ Failed to update orientation:', error)
      alert('Erreur lors de la mise à jour de l\'orientation')
    } finally {
      setIsUpdatingOrientation(false)
    }
  };

  const updateCameraSettings = async (angle: number, distance: number) => {
    console.log('📡 Updating camera settings:', { 
      siteId: flight?.site?.id,
      angle, 
      distance 
    })
    
    if (!flight?.site?.id) {
      console.error('❌ No site ID available')
      return
    }
    
    setIsUpdatingCamera(true)
    try {
      const params = new URLSearchParams()
      params.append('angle', angle.toString())
      params.append('distance', distance.toString())
      
      const url = `sites/${flight.site.id}/camera?${params.toString()}`
      console.log('📡 API URL:', url)
      
      const response = await api.patch(url)
      console.log('📡 API Response:', response)
      
      // Refresh flight data to get updated site
      await queryClient.invalidateQueries({ queryKey: ['flights', flightId] })
      console.log('🔄 Query invalidated, flight data should refresh')
      
      console.log(`✅ Camera updated successfully: angle=${angle}°, distance=${distance}m`)
      
      // Show success message
      alert(`✅ Réglages caméra sauvegardés pour le site "${flight?.site?.name}"!\n\nAngle: ${angle}°\nDistance: ${distance}m\n\nCes réglages s'appliqueront à tous les vols de ce site.`)
    } catch (error) {
      console.error('❌ Failed to update camera settings:', error)
      alert('❌ Erreur lors de la mise à jour de la caméra')
    } finally {
      setIsUpdatingCamera(false)
    }
  };

  // Function to manually reposition camera (can be called after settings update)
  const repositionCamera = useCallback((angle: number, distance: number) => {
    if (!viewerRef.current || !allPositionsRef.current.length) {
      console.warn('⚠️ Cannot reposition camera: viewer or positions not ready')
      return
    }
    
    const viewer = viewerRef.current
    const firstPosition = allPositionsRef.current[0]
    
    if (!firstPosition) {
      console.warn('⚠️ Cannot reposition camera: no first position')
      return
    }
    
    const oppositeHeading = (angle + 180) % 360
    
    console.log(`🎥 Manually repositioning camera: angle=${angle}°, distance=${distance}m`)
    
    // Save camera settings for replay mode
    cameraHeadingRef.current = CesiumMath.toRadians(angle)
    cameraDistanceRef.current = distance
    
    viewer.camera.setView({
      destination: firstPosition,
      orientation: {
        heading: CesiumMath.toRadians(oppositeHeading),
        pitch: CesiumMath.toRadians(-10),
        roll: 0.0
      }
    })
    
    viewer.camera.moveForward(distance)
    
    console.log('✅ Camera manually repositioned')
  }, [])

  const applyCameraSettings = async () => {
    await updateCameraSettings(tempCameraAngle, tempCameraDistance)
    // Immediately reposition the camera with the new settings
    setTimeout(() => {
      repositionCamera(tempCameraAngle, tempCameraDistance)
    }, 500) // Small delay to ensure state is updated
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

  /**
   * Get video bitrate based on quality
   */
  const getVideoBitrate = (quality: '720p' | '1080p' | '4K'): number => {
    switch (quality) {
      case '720p': return 2500000;  // 2.5 Mbps
      case '1080p': return 5000000; // 5 Mbps
      case '4K': return 15000000;   // 15 Mbps
    }
  };

  /**
   * Download blob as file
   */
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };



  const renderOverlay = () => {
    if (isLoading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50 z-20">
          <div className="text-center p-8">
            <p className="text-lg">⏳ Chargement du vol...</p>
            <p className="text-sm text-gray-600 mt-2">Flight ID: {flightId}</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-yellow-50 z-20">
          <div className="bg-white border-2 border-yellow-400 rounded-xl p-8 text-center max-w-md">
            <p className="text-lg font-bold text-yellow-800 mb-2">
              📍 Pas de tracé GPS disponible
            </p>
            <p className="text-sm text-yellow-700">
              Les données GPS ne sont pas disponibles pour ce vol.
            </p>
            <p className="text-xs text-gray-600 mt-2">Error: {String(error)}</p>
          </div>
        </div>
      );
    }

    if (!gpxData?.coordinates) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-20">
          <div className="text-center p-8">
            <p className="text-lg">❌ Aucune donnée GPS disponible</p>
            <p className="text-sm text-gray-600 mt-2">
              GPX Data: {JSON.stringify(gpxData)}
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
      <div className="bg-red-50 border-2 border-red-400 rounded-xl p-8 text-center">
        <p className="text-lg font-bold text-red-800 mb-2">
          ❌ Erreur d'initialisation Cesium
        </p>
        <p className="text-sm text-red-700 mb-4">
          Le viewer 3D n'a pas pu être créé.
        </p>
        <div className="bg-white p-4 rounded text-left text-xs font-mono">
          <p className="font-bold mb-2">Erreur:</p>
          <p className="text-red-600">{viewerError}</p>
        </div>
        <p className="text-xs text-gray-600 mt-4">
          Vérifiez la console du navigateur (F12) pour plus de détails.
        </p>
      </div>
    );
  }

  const containerDivRef = useRef<HTMLDivElement>(null);

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

  // Cleanup export polling on unmount
  useEffect(() => {
    return () => {
      if (exportPollingRef.current) {
        clearInterval(exportPollingRef.current);
        exportPollingRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerDivRef}
      className="relative w-full bg-gray-900" 
      style={{ height: isFullscreen ? '100vh' : '600px' }}
    >
      {/* Overlay for loading/error states */}
      {renderOverlay()}

      {/* Bouton plein écran */}
      {gpxData?.coordinates && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-10 px-3 py-2 bg-gray-800 text-white rounded-lg shadow-lg hover:bg-gray-700"
          title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        >
          {isFullscreen ? '🗗 Quitter' : '⛶ Plein écran'}
        </button>
      )}

      {/* Controls - only show when data is loaded */}
      {gpxData?.coordinates && (
        <div className={`absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg transition-all ${
          isPanelCollapsed ? 'p-2' : 'p-4 max-w-xs'
        }`}>
          <div className="flex items-center justify-between mb-2">
            {!isPanelCollapsed && (
              <h3 className="text-lg font-bold">🪂 {flightTitle}</h3>
            )}
            <button
              onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
              title={isPanelCollapsed ? 'Ouvrir le panneau' : 'Réduire le panneau'}
            >
              {isPanelCollapsed ? '▶' : '◀'}
            </button>
          </div>

          {!isPanelCollapsed && (
            <>
              <p className="text-xs text-gray-500 mb-4">
                Points: {gpxData?.coordinates?.length || 0}
              </p>

              <div className="space-y-3">
            {/* Terrain Loading Indicator */}
            {!terrainReady && (
              <div className="bg-blue-100 border border-blue-400 rounded p-2 mb-3">
                <p className="text-xs text-blue-800 flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Chargement des textures du terrain...
                </p>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <button
                onClick={togglePlayPause}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                onClick={reset}
                className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400"
              >
                ⏮ Reset
              </button>
            </div>

            {/* Video Buttons */}
            {flight?.gpx_file_path && (
              <>
                {/* Debug log */}
                {console.log('🎥 Video button state:', {
                  hasGPX: !!flight.gpx_file_path,
                  status: flight.video_export_status,
                  jobId: flight.video_export_job_id,
                  filePath: flight.video_file_path
                })}
                
                {/* Download/Generate Button */}
                <button
                  onClick={async () => {
                    if (flight.video_export_status === 'completed' && flight.video_file_path) {
                      // Download video
                      window.open(`${API_BASE_URL}/api/exports/${flight.video_export_job_id}/download`, '_blank');
                    } else if (!flight.video_export_status || flight.video_export_status === 'failed') {
                      // Generate video
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/flights/${flightId}/generate-video`, {
                          method: 'POST',
                        });
                        
                        if (!response.ok) {
                          const error = await response.json();
                          alert(`Erreur: ${error.detail || 'Impossible de lancer la génération'}`);
                          return;
                        }
                        
                        const data = await response.json();
                        console.log('✅ Video generation started:', data.job_id);
                        
                        // Refresh flight data to get updated status
                        window.location.reload();
                      } catch (error) {
                        console.error('❌ Failed to start video generation:', error);
                        alert('Erreur lors du lancement de la génération');
                      }
                    }
                  }}
                  disabled={flight.video_export_status === 'processing'}
                  className={`w-full px-3 py-2 text-white rounded ${
                    flight.video_export_status === 'completed' ? 'mb-2' : 'mb-3'
                  } ${
                    flight.video_export_status === 'completed'
                      ? 'bg-green-600 hover:bg-green-700'
                      : flight.video_export_status === 'processing'
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  title={
                    flight.video_export_status === 'processing'
                      ? 'Génération vidéo en cours... (~60-90 min)'
                      : flight.video_export_status === 'completed'
                      ? 'Télécharger la vidéo'
                      : flight.video_export_status === 'failed'
                      ? 'Relancer la génération'
                      : 'Générer la vidéo du vol'
                  }
                >
                  {flight.video_export_status === 'processing' && '⏳ Génération en cours...'}
                  {flight.video_export_status === 'completed' && '📥 Télécharger la vidéo'}
                  {flight.video_export_status === 'failed' && '🔄 Relancer la génération'}
                  {!flight.video_export_status && '🎥 Générer la vidéo'}
                </button>

                {/* Cancel Button (only when processing) */}
                {flight.video_export_status === 'processing' && flight.video_export_job_id && (
                  <button
                    onClick={async () => {
                      if (!confirm('Êtes-vous sûr de vouloir annuler cette génération ?')) {
                        return;
                      }
                      
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/exports/${flight.video_export_job_id}/cancel`, {
                          method: 'DELETE',
                        });
                        
                        if (!response.ok) {
                          const error = await response.json();
                          alert(`Erreur: ${error.detail || 'Impossible d\'annuler la génération'}`);
                          return;
                        }
                        
                        console.log('✅ Video generation cancelled');
                        
                        // Refresh flight data to get updated status
                        window.location.reload();
                      } catch (error) {
                        console.error('❌ Failed to cancel video generation:', error);
                        alert('Erreur lors de l\'annulation');
                      }
                    }}
                    className="w-full px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 mb-3"
                    title="Annuler la génération vidéo en cours"
                  >
                    🛑 Annuler la génération
                  </button>
                )}

                {/* Regenerate Button (only when video exists) */}
                {flight.video_export_status === 'completed' && (
                  <button
                    onClick={async () => {
                      if (!confirm('Êtes-vous sûr de vouloir régénérer cette vidéo ? L\'ancienne vidéo sera remplacée.')) {
                        return;
                      }
                      
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/flights/${flightId}/generate-video`, {
                          method: 'POST',
                        });
                        
                        if (!response.ok) {
                          const error = await response.json();
                          alert(`Erreur: ${error.detail || 'Impossible de lancer la régénération'}`);
                          return;
                        }
                        
                        const data = await response.json();
                        console.log('✅ Video regeneration started:', data.job_id);
                        
                        // Refresh flight data to get updated status
                        window.location.reload();
                      } catch (error) {
                        console.error('❌ Failed to regenerate video:', error);
                        alert('Erreur lors de la régénération');
                      }
                    }}
                    className="w-full px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 mb-3"
                    title="Régénérer la vidéo (remplace l'ancienne)"
                  >
                    🔄 Régénérer la vidéo
                  </button>
                )}
              </>
            )}

            {/* Orientation Selector */}
            {flight?.site && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Orientation Décollage
                </label>
                <select
                  value={flight.site.orientation || ''}
                  onChange={(e) => updateOrientation(e.target.value)}
                  disabled={isUpdatingOrientation}
                  className="w-full px-2 py-1 border rounded text-sm bg-white"
                >
                  <option value="">Non définie</option>
                  {getOrientationOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {flight.site.orientation 
                    ? `Direction: ${getOrientationLabel(flight.site.orientation)}`
                    : 'Direction vers laquelle regarde le pilote'
                  }
                </p>
              </div>
            )}

            {/* Camera Position Controls */}
            {flight?.site && (
              <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
                <label className="block text-sm font-medium mb-2 text-blue-900">
                  📷 Position Caméra
                </label>
                
                {/* Camera Angle */}
                <div className="mb-2">
                  <label className="block text-xs text-gray-600 mb-1">
                    Angle: {tempCameraAngle}° {tempCameraAngle === 0 ? '(Nord)' : tempCameraAngle === 90 ? '(Est)' : tempCameraAngle === 180 ? '(Sud)' : tempCameraAngle === 270 ? '(Ouest)' : ''}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={tempCameraAngle}
                    onChange={(e) => setTempCameraAngle(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0° (N)</span>
                    <span>90° (E)</span>
                    <span>180° (S)</span>
                    <span>270° (W)</span>
                  </div>
                </div>
                
                {/* Camera Distance */}
                <div className="mb-2">
                  <label className="block text-xs text-gray-600 mb-1">
                    Distance: {tempCameraDistance}m
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={tempCameraDistance}
                    onChange={(e) => setTempCameraDistance(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>100m</span>
                    <span>2000m</span>
                  </div>
                </div>
                
                {/* Apply Button */}
                <button
                  onClick={applyCameraSettings}
                  disabled={isUpdatingCamera}
                  className="w-full px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingCamera ? '⏳ Mise à jour...' : '✓ Appliquer'}
                </button>
                
                <p className="text-xs text-gray-600 mt-2">
                  💡 Ces réglages seront sauvegardés pour le site "{flight.site.name}" et appliqués à tous ses vols
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Position: {currentIndexRef.current + 1}/
                {allPositionsRef.current.length}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={currentProgress}
                onChange={(e) => handleProgressChange(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Flight Time Display */}
            <div className="text-sm text-gray-700 font-medium">
              ⏱️ Temps: {formatFlightTime(currentElapsedTime)} / {formatFlightTime(gpxData?.flight_duration_seconds || 0)}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Vitesse: {replaySpeed}x
              </label>
              <input
                type="range"
                min="1"
                max="32"
                value={replaySpeed}
                onChange={(e) => handleSpeedChange(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">
                  Élévation: {elevationOffset.toFixed(1)}m
                </label>
                <button
                  onClick={calculateAutoElevationOffset}
                  disabled={isCalculatingOffset}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                  title="Calculer automatiquement l'offset par rapport au terrain"
                >
                  {isCalculatingOffset ? '⏳' : '🔄'} Auto
                </button>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={elevationOffset}
                onChange={(e) => setElevationOffset(Number(e.target.value))}
                className="w-full"
              />
              {autoOffset !== 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Offset auto: {autoOffset.toFixed(1)}m
                </p>
              )}
            </div>

            {/* Terrain Rendering Section */}
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-bold mb-2">🎨 Rendu du Terrain</h4>
              
              {/* Terrain Shadows Toggle */}
              <label className="flex items-center text-sm mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={terrainShadows}
                  onChange={(e) => setTerrainShadows(e.target.checked)}
                  className="mr-2 cursor-pointer"
                />
                Ombres du terrain
              </label>
              
              {/* Ambient Occlusion Toggle */}
              <label className="flex items-center text-sm mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ambientOcclusion}
                  onChange={(e) => setAmbientOcclusion(e.target.checked)}
                  className="mr-2 cursor-pointer"
                />
                Ambient Occlusion (AO)
              </label>
              
              {/* Sun Time Slider */}
              <div className="mt-2">
                <label className="block text-sm font-medium mb-1">
                  Heure: {sunTime}h00
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
                  Lumière: {lightIntensity.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={lightIntensity}
                  onChange={(e) => setLightIntensity(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      )}


      {/* Cesium Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default FlightViewer3D;
