import { useRef, useEffect, useState, useCallback } from 'react'
import * as Cesium from 'cesium'

export interface GeoPoint {
  lat: number
  lon: number
  elevation: number
  timestamp: number
}

export interface CesiumViewerInstance {
  addPolyline: (coords: GeoPoint[]) => void
  addPolylineVolume: (coords: GeoPoint[]) => void
  playReplay: (coords: GeoPoint[], duration: number) => void
  stopReplay: () => void
  zoomToTrack: () => void
  takeScreenshot: () => string
}

/**
 * Hook for managing Cesium 3D viewer
 * Handles initialization, track drawing, and animation
 */
export const useCesiumViewer = () => {
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isReplaying, setIsReplaying] = useState(false)
  const dataSourceRef = useRef<Cesium.DataSourceCollection | null>(null)
  const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initialize Cesium viewer when container ref is set
  useEffect(() => {
    const container = document.getElementById('cesium-container')
    if (!container || viewerRef.current) return

    try {
      // Set Cesium token (optional but recommended)
      // Cesium.Ion.defaultAccessToken = process.env.VITE_CESIUM_ION_TOKEN || ''

      const viewer = new Cesium.Viewer('cesium-container', {
        terrain: Cesium.Terrain.fromWorldTerrain(),
        animation: true,
        timeline: false,
        fullscreenButton: true,
        vrButton: false,
        sceneModePicker: true,
        navigationHelpButton: false,
        homeButton: true,
      })

      viewerRef.current = viewer
      dataSourceRef.current = viewer.dataSources
      setIsReady(true)
    } catch (error) {
      console.error('Failed to initialize Cesium viewer:', error)
    }

    // Cleanup on unmount
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [])

  /**
   * Draw polyline track on 3D map
   */
  const addPolyline = useCallback((coords: GeoPoint[]) => {
    if (!viewerRef.current) return

    const viewer = viewerRef.current
    const positions = coords.map(point =>
      Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.elevation)
    )

    viewer.entities.add({
      id: 'flight-polyline',
      polyline: {
        positions: positions,
        width: 3,
        material: Cesium.Color.CYAN.withAlpha(0.8),
        clampToGround: false,
      },
    })

    // Add markers at start and end
    viewer.entities.add({
      id: 'flight-start-marker',
      position: positions[0],
      point: {
        pixelSize: 10,
        color: Cesium.Color.GREEN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: 'START',
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new Cesium.Cartesian2(0, -20),
      },
    })

    viewer.entities.add({
      id: 'flight-end-marker',
      position: positions[positions.length - 1],
      point: {
        pixelSize: 10,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: 'END',
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new Cesium.Cartesian2(0, -20),
      },
    })
  }, [])

  /**
   * Draw 3D polyline volume (cylinder along the track)
   */
  const addPolylineVolume = useCallback((coords: GeoPoint[]) => {
    if (!viewerRef.current) return

    const viewer = viewerRef.current
    const positions = coords.map(point =>
      Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.elevation)
    )

    viewer.entities.add({
      id: 'flight-polyline-volume',
      polylineVolume: {
        positions: positions,
        shape: [new Cesium.Cartesian2(-15, -15), new Cesium.Cartesian2(15, 15)],
        material: Cesium.Color.CYAN.withAlpha(0.5),
        outline: true,
        outlineColor: Cesium.Color.CYAN,
      },
    })
  }, [])

  /**
   * Play replay animation of the flight
   * @param coords Flight track coordinates
   * @param duration Animation duration in seconds
   */
  const playReplay = useCallback(
    (coords: GeoPoint[], duration: number) => {
      if (!viewerRef.current || coords.length === 0) return

      const viewer = viewerRef.current
      const totalPoints = coords.length
      let currentIndex = 0

      setIsReplaying(true)

      // Create animated entity
      const animatedPoint = viewer.entities.add({
        id: 'flight-replay-point',
        position: Cesium.Cartesian3.fromDegrees(
          coords[0].lon,
          coords[0].lat,
          coords[0].elevation
        ),
        point: {
          pixelSize: 8,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: '🪂',
          font: '20px sans-serif',
          pixelOffset: new Cesium.Cartesian2(0, -20),
        },
      })

      const intervalMs = (duration * 1000) / totalPoints

      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current)
      }

      replayIntervalRef.current = setInterval(() => {
        if (currentIndex < totalPoints) {
          const point = coords[currentIndex]
          const newPosition = Cesium.Cartesian3.fromDegrees(
            point.lon,
            point.lat,
            point.elevation
          )
          
          // Update position
          animatedPoint.position = new Cesium.ConstantPositionProperty(newPosition)

          // Follow with camera
          viewer.camera.lookAt(
            newPosition,
            new Cesium.Cartesian3(0, -1000, 800)
          )

          currentIndex++
        } else {
          // Replay finished
          if (replayIntervalRef.current) {
            clearInterval(replayIntervalRef.current)
            replayIntervalRef.current = null
          }
          setIsReplaying(false)
        }
      }, intervalMs)
    },
    []
  )

  /**
   * Stop replay animation
   */
  const stopReplay = useCallback(() => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current)
      replayIntervalRef.current = null
    }
    setIsReplaying(false)
  }, [])

  /**
   * Zoom camera to fit entire track
   */
  const zoomToTrack = useCallback(() => {
    if (!viewerRef.current) return

    const viewer = viewerRef.current
    const entities = viewer.entities.values

    if (entities.length > 0) {
      viewer.zoomTo(viewer.entities)
    }
  }, [])

  /**
   * Take screenshot of the viewer
   */
  const takeScreenshot = useCallback((): string => {
    if (!viewerRef.current) return ''

    const viewer = viewerRef.current
    const canvas = viewer.canvas
    return canvas.toDataURL('image/png')
  }, [])

  return {
    isReady,
    isReplaying,
    addPolyline,
    addPolylineVolume,
    playReplay,
    stopReplay,
    zoomToTrack,
    takeScreenshot,
  }
}
