import React, { useCallback, useRef, useState, ChangeEvent } from 'react'
import { CesiumComponentRef, Viewer } from 'resium'
import {
  ArcType,
  CallbackProperty,
  Cartesian3,
  Cartographic,
  Color,
  ConstantPositionProperty,
  Entity as CesiumEntity,
  GpxDataSource,
  JulianDate,
  Rectangle,
  Terrain,
  Viewer as CesiumViewer,
} from 'cesium'
import { useFlightGPX } from '../hooks/useFlightGPX'

export interface FlightViewer3DProps {
  flightId: string
  flightTitle?: string
}

interface CesiumPositionPropertyInternal {
  _property?: {
    _times?: JulianDate[]
  }
}

export const FlightViewer3D: React.FC<FlightViewer3DProps> = ({
  flightId,
  flightTitle = 'Flight View',
}) => {
  const { data: gpxData, isLoading, error } = useFlightGPX(flightId)
  const viewerRef = useRef<CesiumComponentRef<CesiumViewer>>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState(1)

  const allPositionsRef = useRef<Cartesian3[]>([])
  const basePositionsRef = useRef<Cartesian3[]>([])
  const timestampsRef = useRef<number[]>([])
  const currentIndexRef = useRef(0)
  const isPlayingRef = useRef(false)
  const speedRef = useRef(1)
  const realTimeStartRef = useRef<number>(0)
  const gpxStartTimeRef = useRef<number>(0)

  const polylineEntityRef = useRef<CesiumEntity | null>(null)
  const cursorEntityRef = useRef<CesiumEntity | null>(null)
  const startEntityRef = useRef<CesiumEntity | null>(null)
  const visiblePositionsRef = useRef<Cartesian3[]>([])
  const cursorPositionPropertyRef = useRef<ConstantPositionProperty | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const extractTimestamps = useCallback((dataSource: GpxDataSource): number[] => {
    const timestamps: number[] = []

    dataSource.entities.values.forEach((entity) => {
      if (!entity.position) return

      const positionProperty = entity.position as unknown as CesiumPositionPropertyInternal

      if (positionProperty._property?._times) {
        positionProperty._property._times.forEach((julianDate) => {
          timestamps.push(JulianDate.toDate(julianDate).getTime())
        })
      } else if (entity.availability) {
        try {
          const start = entity.availability.start
          const stop = entity.availability.stop

          if (start && stop) {
            timestamps.push(JulianDate.toDate(start).getTime())
            timestamps.push(JulianDate.toDate(stop).getTime())
          }
        } catch (e) {
          console.warn('Could not extract timestamps', e)
        }
      }
    })

    return timestamps
  }, [])

  // Initialize viewer with GPX data
  React.useEffect(() => {
    if (!gpxData?.coordinates || gpxData.coordinates.length === 0) return

    const viewer = viewerRef.current?.cesiumElement
    if (!viewer) return

    try {
      // Convert GPX coordinates to Cartesian3
      const positions = gpxData.coordinates.map((point) =>
        Cartesian3.fromDegrees(point.lon, point.lat, point.elevation)
      )

      // Generate timestamps if not available
      let timestamps = gpxData.timestamps || []
      if (timestamps.length === 0 || timestamps.length !== positions.length) {
        const avgSpeedKmh = 5
        const avgSpeedMs = (avgSpeedKmh * 1000) / 3600

        timestamps = [Date.now()]
        for (let i = 1; i < positions.length; i++) {
          const distance = Cartesian3.distance(positions[i - 1], positions[i])
          const timeMs = (distance / avgSpeedMs) * 1000
          timestamps.push(timestamps[i - 1] + timeMs)
        }
      }

      basePositionsRef.current = positions
      allPositionsRef.current = positions
      timestampsRef.current = timestamps
      currentIndexRef.current = 0
      visiblePositionsRef.current = [positions[0]]

      // Clean old entities
      if (polylineEntityRef.current) viewer.entities.remove(polylineEntityRef.current)
      if (cursorEntityRef.current) viewer.entities.remove(cursorEntityRef.current)
      if (startEntityRef.current) viewer.entities.remove(startEntityRef.current)

      // Create polyline
      polylineEntityRef.current = viewer.entities.add({
        polyline: {
          positions: new CallbackProperty(() => {
            return visiblePositionsRef.current
          }, false),
          width: 5,
          material: Color.RED,
          clampToGround: false,
          arcType: ArcType.NONE,
        },
      })

      // Create cursor
      cursorPositionPropertyRef.current = new ConstantPositionProperty(positions[0])

      cursorEntityRef.current = viewer.entities.add({
        position: cursorPositionPropertyRef.current,
        point: {
          pixelSize: 12,
          color: Color.YELLOW,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })

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
      })

      // Fly to track
      viewer.camera.flyTo({
        destination: Rectangle.fromCartesianArray(positions),
        duration: 2,
      })
    } catch (err) {
      console.error('Error loading GPX data:', err)
    }
  }, [gpxData, extractTimestamps])

  const play = useCallback(() => {
    if (intervalRef.current || allPositionsRef.current.length === 0) return

    isPlayingRef.current = true
    setIsPlaying(true)

    realTimeStartRef.current = Date.now()
    gpxStartTimeRef.current = timestampsRef.current[currentIndexRef.current]

    intervalRef.current = setInterval(() => {
      if (currentIndexRef.current >= allPositionsRef.current.length - 1) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        isPlayingRef.current = false
        setIsPlaying(false)
        return
      }

      const speed = speedRef.current
      const elapsedRealTime = Date.now() - realTimeStartRef.current
      const elapsedGpxTime = elapsedRealTime * speed
      const targetGpxTime = gpxStartTimeRef.current + elapsedGpxTime

      let targetIndex = currentIndexRef.current
      for (let i = currentIndexRef.current; i < timestampsRef.current.length; i++) {
        if (timestampsRef.current[i] <= targetGpxTime) {
          targetIndex = i
        } else {
          break
        }
      }

      if (targetIndex > currentIndexRef.current) {
        currentIndexRef.current = targetIndex
        visiblePositionsRef.current = allPositionsRef.current.slice(0, currentIndexRef.current + 1)

        if (cursorPositionPropertyRef.current) {
          cursorPositionPropertyRef.current.setValue(
            allPositionsRef.current[currentIndexRef.current]
          )
        }
      }
    }, 16)
  }, [])

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    isPlayingRef.current = false
    setIsPlaying(false)
  }, [])

  const reset = useCallback(() => {
    pause()
    currentIndexRef.current = 0

    if (allPositionsRef.current.length > 0) {
      visiblePositionsRef.current = [allPositionsRef.current[0]]

      if (cursorPositionPropertyRef.current) {
        cursorPositionPropertyRef.current.setValue(allPositionsRef.current[0])
      }
    }
  }, [pause])

  const handleSpeedChange = (value: number) => {
    setReplaySpeed(value)
    speedRef.current = value

    if (isPlayingRef.current) {
      pause()
      setTimeout(() => play(), 50)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Chargement du vol...</div>
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-8 text-center">
        <p className="text-lg font-bold text-yellow-800 mb-2">📍 Pas de tracé GPS disponible</p>
        <p className="text-sm text-yellow-700">
          Les données GPS ne sont pas disponibles pour ce vol.
        </p>
      </div>
    )
  }

  if (!gpxData?.coordinates) {
    return <div className="text-center py-8">Aucune donnée GPS disponible</div>
  }

  return (
    <div className="relative w-full" style={{ height: '600px' }}>
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 bg-white p-4 rounded-lg shadow-lg max-w-xs">
        <h3 className="text-lg font-bold mb-4">🪂 {flightTitle}</h3>

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
            <label className="block text-sm font-medium mb-1">Vitesse: {replaySpeed}x</label>
            <input
              type="range"
              min="1"
              max="32"
              value={replaySpeed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Cesium Viewer */}
      <Viewer
        ref={viewerRef}
        full
        terrain={Terrain.fromWorldTerrain()}
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        fullscreenButton={false}
        navigationHelpButton={false}
        sceneModePicker={false}
        infoBox={false}
        selectionIndicator={false}
      />
    </div>
  )
}
