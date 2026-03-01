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
} from 'cesium';
import { useFlightGPX } from '../hooks/useFlightGPX';

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
  const [elevationOffset, setElevationOffset] = useState(0);
  const [autoOffset, setAutoOffset] = useState(0);
  const [isCalculatingOffset, setIsCalculatingOffset] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Réinitialiser les offsets quand on change de vol
  useEffect(() => {
    setElevationOffset(0);
    setAutoOffset(0);
  }, [flightId]);

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
          width: 5,
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
          pixelSize: 12,
          color: Color.YELLOW,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      // Create start marker
      startEntityRef.current = viewer.entities.add({
        position: positions[0],
        point: {
          pixelSize: 10,
          color: Color.GREEN,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      // Calculate bounding sphere for better camera positioning
      const boundingSphere = BoundingSphere.fromPoints(positions);

      // Fly to track - on le fait toujours, même si l'offset n'est pas encore calculé
      // Au 2e passage (après calcul de l'offset), la caméra sera repositionnée correctement
      setTimeout(() => {
        if (viewer && !viewer.isDestroyed()) {
          viewer.camera.flyToBoundingSphere(boundingSphere, {
            duration: 2,
            offset: new HeadingPitchRange(
              0, // heading: 0 = Nord
              -Math.PI / 4, // pitch: -45° (vue aérienne oblique)
              boundingSphere.radius * 2.5 // distance optimale pour bonne vue d'ensemble
            ),
          });
        }
      }, 500);
    } catch (err) {
      console.error('Error loading GPX data:', err);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

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

        if (cursorPositionPropertyRef.current) {
          cursorPositionPropertyRef.current.setValue(
            allPositionsRef.current[currentIndexRef.current]
          );
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
            <div className="flex gap-2">
              <button
                onClick={() => (isPlayingRef.current ? pause() : play())}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                onClick={reset}
                className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                ⏮ Reset
              </button>
            </div>

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
