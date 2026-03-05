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
} from 'cesium';
import { useFlightGPX } from '../hooks/useFlightGPX';
import { ExportVideoModal, VideoExportConfig } from './ExportVideoModal';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface FlightViewer3DProps {
  flightId: string;
  flightTitle?: string;
}

/**
 * FlightViewer3D - 3D flight viewer using Cesium
 */
export const FlightViewer3D: React.FC<FlightViewer3DProps> = ({
  flightId,
  flightTitle = 'Flight View',
}) => {
  const { data: gpxData, isLoading, error } = useFlightGPX(flightId);
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

  // Video export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordingPhase, setRecordingPhase] = useState<'loading' | 'capturing' | 'encoding' | 'done'>('capturing');
  const [capturedFrames, setCapturedFrames] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const capturedFramesDataRef = useRef<Uint8Array[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    // Check if terrain is already loaded
    const globe = viewer.scene.globe;
    
    const checkTerrainReady = () => {
      // Check if tiles are loaded in the current view
      const tilesLoaded = globe.tilesLoaded;
      
      if (tilesLoaded) {
        console.log('✅ Terrain textures loaded');
        setTerrainReady(true);
      } else {
        console.log('⏳ Waiting for terrain textures...');
        // Check again after a short delay
        setTimeout(checkTerrainReady, 500);
      }
    };

    // Start checking after a small delay
    const timeoutId = setTimeout(checkTerrainReady, 1000);

    return () => clearTimeout(timeoutId);
  }, [viewerReady]);

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
        
        // Use a point further in the flight (20% through) as reference
        const referenceIndex = Math.floor(numPoints * 0.2);
        const referenceCoord = gpxData.coordinates[referenceIndex];
        
        // Calculate heading from reference point BACK to takeoff
        // This makes the camera look toward the takeoff/launch site
        const deltaLon = takeoffCoord.lon - referenceCoord.lon;
        const deltaLat = takeoffCoord.lat - referenceCoord.lat;
        
        // Calculate angle in radians (0 = North, clockwise)
        const headingToTakeoff = Math.atan2(deltaLon, deltaLat);
        
        console.log(`🛫 Takeoff position: ${takeoffCoord.lat.toFixed(4)}, ${takeoffCoord.lon.toFixed(4)}`);
        console.log(`📍 Reference position (20%): ${referenceCoord.lat.toFixed(4)}, ${referenceCoord.lon.toFixed(4)}`);
        console.log(`📷 Camera heading: ${(headingToTakeoff * 180 / Math.PI).toFixed(1)}° (facing takeoff)`);
        
        return headingToTakeoff;
      };

      // Position camera - MUST happen after elevation offset is calculated
      // Using a very low angle to see the altitude of the flight track
      const positionCamera = async () => {
        if (viewer && !viewer.isDestroyed()) {
          const heading = await calculateOptimalHeading();
          cameraHeadingRef.current = heading;
          cameraDistanceRef.current = boundingSphere.radius * 0.8; // Vue plus rapprochée
          
          viewer.camera.flyToBoundingSphere(boundingSphere, {
            duration: 2,
            offset: new HeadingPitchRange(
              heading, // heading perpendicular to flight direction
              -0.05, // pitch: légèrement incliné vers le bas pour voir le sol
              cameraDistanceRef.current // distance plus proche pour meilleure immersion
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

  /**
   * Load FFmpeg.wasm
   */
  const loadFFmpeg = async (): Promise<FFmpeg> => {
    if (ffmpegRef.current) {
      return ffmpegRef.current;
    }

    const ffmpeg = new FFmpeg();
    
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });

    ffmpeg.on('progress', ({ progress }) => {
      if (recordingPhase === 'encoding') {
        setRecordingProgress(Math.round(progress * 100));
      }
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  /**
   * Capture a single frame from the canvas
   */
  const captureFrame = async (canvas: HTMLCanvasElement): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(new Uint8Array(0));
          return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(new Uint8Array(reader.result as ArrayBuffer));
        };
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    });
  };

  /**
   * Start video export with frame-by-frame capture
   */
  const startVideoExport = async (config: VideoExportConfig) => {
    const viewer = viewerRef.current;
    if (!viewer || allPositionsRef.current.length === 0) {
      console.error('Viewer not initialized or no positions');
      return;
    }
    
    try {
      console.log('🎥 Starting frame-by-frame export with config:', config);
      
      // Close modal
      setShowExportModal(false);
      
      // Setup recording state
      setIsRecording(true);
      setRecordingPhase('loading');
      setRecordingProgress(0);
      setCapturedFrames(0);
      capturedFramesDataRef.current = [];
      
      // Phase 1: Load FFmpeg
      console.log('📦 Loading FFmpeg.wasm...');
      await loadFFmpeg();
      console.log('✅ FFmpeg loaded');
      
      // Phase 2: Calculate frames needed
      setRecordingPhase('capturing');
      
      const canvas = viewer.scene.canvas;
      const totalPositions = allPositionsRef.current.length;
      const timestamps = timestampsRef.current;
      
      if (timestamps.length === 0 || timestamps.length !== totalPositions) {
        throw new Error('GPS timestamps not available');
      }
      
      // Calculate how many frames we need based on flight duration and FPS
      const startTime = timestamps[0];
      const endTime = timestamps[timestamps.length - 1];
      const flightDurationMs = endTime - startTime;
      const flightDurationSeconds = flightDurationMs / 1000;
      
      // Video duration = flight duration / speed
      const videoDurationSeconds = flightDurationSeconds / config.speed;
      
      // Frames needed = video duration × FPS
      const framesToCapture = Math.ceil(videoDurationSeconds * config.fps);
      setTotalFrames(framesToCapture);
      
      // Time between each frame in GPS time
      const msPerFrame = flightDurationMs / framesToCapture;
      
      console.log(`📸 Flight duration: ${(flightDurationSeconds / 60).toFixed(1)} min`);
      console.log(`📸 Video duration: ${(videoDurationSeconds / 60).toFixed(1)} min at ${config.speed}x speed`);
      console.log(`📸 Capturing ${framesToCapture} frames at ${config.fps} FPS`);
      console.log(`📸 Time per frame: ${msPerFrame.toFixed(0)}ms GPS time`);
      
      // Reset to start
      reset();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Pause animation (we'll control it manually)
      pause();
      
      // Phase 3: Capture frames one by one
      for (let frameIndex = 0; frameIndex < framesToCapture; frameIndex++) {
        // Calculate the GPS time for this frame
        const targetTime = startTime + (frameIndex * msPerFrame);
        
        // Find the closest position to this time
        let positionIndex = 0;
        for (let i = 0; i < timestamps.length - 1; i++) {
          if (timestamps[i] <= targetTime && timestamps[i + 1] > targetTime) {
            positionIndex = i;
            break;
          }
        }
        
        if (positionIndex >= totalPositions - 1) {
          positionIndex = totalPositions - 1;
        }
        
        // Move to this position
        currentIndexRef.current = positionIndex;
        const currentPositions = allPositionsRef.current.slice(0, positionIndex + 1);
        visiblePositionsRef.current = currentPositions;
        
        // Update cursor position
        const currentPosition = allPositionsRef.current[positionIndex];
        if (cursorPositionPropertyRef.current) {
          cursorPositionPropertyRef.current.setValue(currentPosition);
        }
        
        // Note: polyline is updated automatically via CallbackProperty reading visiblePositionsRef
        
        // Update camera to follow the cursor
        const heading = cameraHeadingRef.current;
        const distance = cameraDistanceRef.current;
        const pitch = -0.05;
        
        // Use smooth camera positioning like in the animation
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
        
        viewer.camera.setView({
          destination: cameraTargetRef.current,
          orientation: {
            heading: heading,
            pitch: pitch,
            roll: 0
          }
        });
        viewer.camera.moveBackward(distance);
        
        // Force Cesium to render the scene
        viewer.scene.render();
        
        // Wait a bit longer for tiles to load and scene to stabilize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Force another render to be sure
        viewer.scene.render();
        
        // Capture frame
        const frameData = await captureFrame(canvas);
        capturedFramesDataRef.current.push(frameData);
        
        // Update progress
        setCapturedFrames(frameIndex + 1);
        setRecordingProgress(Math.round(((frameIndex + 1) / framesToCapture) * 50)); // 0-50% for capture
        
        if (frameIndex % 10 === 0) {
          console.log(`📸 Frame ${frameIndex + 1}/${framesToCapture} captured`);
        }
      }
      
      console.log(`✅ All ${framesToCapture} frames captured`);
      
      // Phase 4: Encode video with FFmpeg
      setRecordingPhase('encoding');
      setRecordingProgress(50);
      
      const ffmpeg = ffmpegRef.current!;
      
      console.log('🎬 Writing frames to FFmpeg virtual filesystem...');
      
      // Write all frames to FFmpeg filesystem
      for (let i = 0; i < capturedFramesDataRef.current.length; i++) {
        const filename = `frame${i.toString().padStart(5, '0')}.png`;
        await ffmpeg.writeFile(filename, capturedFramesDataRef.current[i]);
      }
      
      console.log('🎬 Encoding video...');
      
      // Encode video
      const outputFilename = 'output.mp4';
      const quality = config.quality === '4K' ? '3840:2160' : config.quality === '1080p' ? '1920:1080' : '1280:720';
      
      await ffmpeg.exec([
        '-framerate', config.fps.toString(),
        '-i', 'frame%05d.png',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-s', quality,
        outputFilename
      ]);
      
      console.log('✅ Video encoded');
      
      // Read the output file
      const data = await ffmpeg.readFile(outputFilename);
      const videoBlob = new Blob([data], { type: 'video/mp4' });
      
      console.log(`✅ Video ready: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `flight-${flightId}-${timestamp}.mp4`;
      downloadBlob(videoBlob, filename);
      
      // Cleanup FFmpeg filesystem
      console.log('🧹 Cleaning up...');
      for (let i = 0; i < capturedFramesDataRef.current.length; i++) {
        const fname = `frame${i.toString().padStart(5, '0')}.png`;
        try {
          await ffmpeg.deleteFile(fname);
        } catch (e) {
          // Ignore errors
        }
      }
      try {
        await ffmpeg.deleteFile(outputFilename);
      } catch (e) {
        // Ignore errors
      }
      
      // Cleanup
      setRecordingPhase('done');
      setRecordingProgress(100);
      capturedFramesDataRef.current = [];
      
      // Show success and cleanup
      setTimeout(() => {
        setIsRecording(false);
        setRecordingProgress(0);
        setCapturedFrames(0);
        setTotalFrames(0);
        
        alert(`✅ Vidéo exportée avec succès!\n\nFichier: ${filename}\nTaille: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB\n\nLa vidéo est parfaitement fluide à ${config.fps} FPS!`);
      }, 1000);
      
    } catch (error) {
      console.error('❌ Video export error:', error);
      setIsRecording(false);
      setRecordingProgress(0);
      setCapturedFrames(0);
      setTotalFrames(0);
      capturedFramesDataRef.current = [];
      alert(`❌ Erreur lors de l'export: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  /**
   * Cancel ongoing recording
   */
  const cancelVideoExport = () => {
    setIsRecording(false);
    setRecordingProgress(0);
    setCapturedFrames(0);
    setTotalFrames(0);
    capturedFramesDataRef.current = [];
    
    console.log('❌ Export cancelled by user');
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
                onClick={() => (isPlayingRef.current ? pause() : play())}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                disabled={isRecording || !terrainReady}
                title={!terrainReady ? 'Chargement du terrain...' : ''}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                onClick={reset}
                className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400"
                disabled={isRecording || !terrainReady}
                title={!terrainReady ? 'Chargement du terrain...' : ''}
              >
                ⏮ Reset
              </button>
            </div>

            {/* Export Video Button */}
            <button
              onClick={() => setShowExportModal(true)}
              disabled={isRecording || isPlaying || !gpxData?.coordinates || !terrainReady}
              className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 mb-3"
              title={!terrainReady ? 'Chargement du terrain...' : 'Exporter le vol en vidéo'}
            >
              {isRecording ? '⏺️ Enregistrement...' : '🎥 Export Vidéo'}
            </button>

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

      {/* Recording Progress Overlay */}
      {isRecording && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-black/90 text-white px-8 py-6 rounded-lg shadow-2xl min-w-[450px]">
          <div className="flex items-center gap-4 mb-4">
            <div className="animate-pulse text-3xl">
              {recordingPhase === 'loading' && '📦'}
              {recordingPhase === 'capturing' && '📸'}
              {recordingPhase === 'encoding' && '🎬'}
              {recordingPhase === 'done' && '✅'}
            </div>
            <div>
              <div className="font-bold text-lg">
                {recordingPhase === 'loading' && 'Chargement FFmpeg...'}
                {recordingPhase === 'capturing' && 'Capture des frames...'}
                {recordingPhase === 'encoding' && 'Encodage vidéo...'}
                {recordingPhase === 'done' && 'Export terminé!'}
              </div>
              <div className="text-sm text-gray-300">
                {recordingPhase === 'loading' && 'Chargement de FFmpeg.wasm (~31MB)'}
                {recordingPhase === 'capturing' && `Frame ${capturedFrames}/${totalFrames}`}
                {recordingPhase === 'encoding' && 'Création du fichier MP4...'}
                {recordingPhase === 'done' && 'Téléchargement en cours...'}
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
            <div 
              className="bg-red-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${recordingProgress}%` }}
            />
          </div>
          
          {/* Progress Text */}
          <div className="text-center text-sm text-gray-300">
            {Math.round(recordingProgress)}%
          </div>
          
          {recordingPhase !== 'done' && (
            <>
              {/* Info Text */}
              <div className="text-xs text-gray-400 text-center mt-3">
                Ne fermez pas cette page
              </div>
              
              {/* Cancel Button */}
              <button
                onClick={cancelVideoExport}
                className="w-full mt-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                ❌ Annuler
              </button>
            </>
          )}
        </div>
      )}

      {/* Export Video Modal */}
      <ExportVideoModal
        isOpen={showExportModal}
        flightDuration={gpxData?.flight_duration_seconds || 0}
        onExport={startVideoExport}
        onCancel={() => setShowExportModal(false)}
      />

      {/* Cesium Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default FlightViewer3D;
