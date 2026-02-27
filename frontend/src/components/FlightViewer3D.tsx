import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Viewer, Entity, PolylineGraphics, CameraFlyTo } from 'resium'
import { Cartesian3, Color, Viewer as CesiumViewer, ConstantPositionProperty } from 'cesium'
import { useFlightGPX, useFlightElevationProfile, useDownloadGPX } from '../hooks/useFlightGPX'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface FlightViewer3DProps {
  flightId: string
  flightTitle?: string
  showReplay?: boolean
  showElevationChart?: boolean
}

export interface GeoPoint {
  lat: number
  lon: number
  elevation: number
  timestamp: number
}

/**
 * 3D Flight Viewer with Cesium + Resium
 * Displays track on 3D map, elevation profile, and replay controls
 */
export const FlightViewer3D: React.FC<FlightViewer3DProps> = ({
  flightId,
  flightTitle,
  showReplay = true,
  showElevationChart = true,
}) => {
  const { data: gpxData, isLoading: gpxLoading, error: gpxError } = useFlightGPX(flightId)
  const elevationProfile = useFlightElevationProfile(flightId)
  const downloadGPX = useDownloadGPX()
  const viewerRef = useRef<CesiumViewer | null>(null)

  const [replayDuration, setReplayDuration] = useState(30)
  const [isReplaying, setIsReplaying] = useState(false)
  const [replayIndex, setReplayIndex] = useState(0)
  const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Convert GPX coordinates to Cesium Cartesian3 positions
  const positions = gpxData?.coordinates
    ? gpxData.coordinates.map((point: GeoPoint) =>
        Cartesian3.fromDegrees(point.lon, point.lat, point.elevation)
      )
    : []

  // Get current replay position
  const currentReplayPosition =
    gpxData?.coordinates && replayIndex < gpxData.coordinates.length
      ? gpxData.coordinates[replayIndex]
      : null

  const currentReplayCartesian = currentReplayPosition
    ? Cartesian3.fromDegrees(
        currentReplayPosition.lon,
        currentReplayPosition.lat,
        currentReplayPosition.elevation
      )
    : null

  // Start replay animation
  const handlePlayReplay = useCallback(() => {
    if (!gpxData?.coordinates || gpxData.coordinates.length === 0) return

    setIsReplaying(true)
    setReplayIndex(0)

    const totalPoints = gpxData.coordinates.length
    const intervalMs = (replayDuration * 1000) / totalPoints

    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current)
    }

    replayIntervalRef.current = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= totalPoints - 1) {
          if (replayIntervalRef.current) {
            clearInterval(replayIntervalRef.current)
            replayIntervalRef.current = null
          }
          setIsReplaying(false)
          return 0
        }
        return prev + 1
      })
    }, intervalMs)
  }, [gpxData, replayDuration])

  // Stop replay
  const handleStopReplay = useCallback(() => {
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current)
      replayIntervalRef.current = null
    }
    setIsReplaying(false)
    setReplayIndex(0)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current)
      }
    }
  }, [])

  // Handle download GPX
  const handleDownload = async () => {
    try {
      await downloadGPX(flightId, `${flightTitle || 'flight'}.gpx`)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  // Chart data for elevation profile
  const chartData = elevationProfile.data.map((point, index) => ({
    index,
    elevation: Math.round(point.elevation),
    distance: (index / elevationProfile.data.length) * elevationProfile.totalDistance,
  }))

  // Check if GPX is not available (404 error)
  const isGPXNotAvailable = gpxError && (gpxError as any)?.response?.status === 404

  return (
    <div className="relative">
      {/* GPX Not Available Message */}
      {isGPXNotAvailable ? (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-8 text-center">
          <p className="text-lg font-bold text-yellow-800 mb-2">📍 Pas de tracé GPS disponible</p>
          <p className="text-sm text-yellow-700">
            Les données GPS ne sont pas disponibles pour ce vol. La carte 3D ne peut pas être
            affichée.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white p-4 rounded-t-xl border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              🪂 {flightTitle || 'Flight View'}
            </h2>
            <div className="flex flex-wrap gap-3">
              {showReplay && (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Replay Speed (s):</span>
                    <input
                      type="number"
                      min="10"
                      max="120"
                      value={replayDuration}
                      onChange={(e) => setReplayDuration(Number(e.target.value))}
                      disabled={isReplaying}
                      className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:bg-gray-100"
                    />
                  </label>
                  <button
                    onClick={handlePlayReplay}
                    disabled={gpxLoading || isReplaying || !gpxData?.coordinates}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isReplaying ? '⏸ Playing...' : '▶ Play Replay'}
                  </button>
                  {isReplaying && (
                    <button
                      onClick={handleStopReplay}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-all"
                    >
                      ⏹ Stop
                    </button>
                  )}
                </div>
              )}
              <button
                onClick={handleDownload}
                disabled={gpxLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                📥 Download GPX
              </button>
            </div>
          </div>

          {/* 3D Viewer with Resium */}
          <div className="w-full h-[600px] bg-gray-900">
            <Viewer
              full
              ref={(e) => {
                if (e?.cesiumElement) {
                  viewerRef.current = e.cesiumElement
                }
              }}
              animation={false}
              timeline={false}
              fullscreenButton={false}
              vrButton={false}
              sceneModePicker={false}
              navigationHelpButton={false}
              homeButton={false}
              infoBox={false}
              selectionIndicator={false}
              baseLayerPicker={false}
            >
              {/* Flight Track Polyline */}
              {positions.length > 0 && (
                <Entity id="flight-polyline">
                  <PolylineGraphics
                    positions={positions}
                    width={3}
                    material={Color.CYAN.withAlpha(0.8)}
                    clampToGround={false}
                  />
                </Entity>
              )}

              {/* Start Marker */}
              {positions.length > 0 && (
                <Entity
                  id="flight-start-marker"
                  position={positions[0]}
                  point={{
                    pixelSize: 10,
                    color: Color.GREEN,
                    outlineColor: Color.WHITE,
                    outlineWidth: 2,
                  }}
                  label={{
                    text: 'START',
                    font: '12px sans-serif',
                    fillColor: Color.WHITE,
                    outlineColor: Color.BLACK,
                    outlineWidth: 2,
                    pixelOffset: { x: 0, y: -20 } as any,
                  }}
                />
              )}

              {/* End Marker */}
              {positions.length > 0 && (
                <Entity
                  id="flight-end-marker"
                  position={positions[positions.length - 1]}
                  point={{
                    pixelSize: 10,
                    color: Color.RED,
                    outlineColor: Color.WHITE,
                    outlineWidth: 2,
                  }}
                  label={{
                    text: 'END',
                    font: '12px sans-serif',
                    fillColor: Color.WHITE,
                    outlineColor: Color.BLACK,
                    outlineWidth: 2,
                    pixelOffset: { x: 0, y: -20 } as any,
                  }}
                />
              )}

              {/* Replay Animation Point */}
              {isReplaying && currentReplayCartesian && (
                <Entity
                  id="flight-replay-point"
                  position={currentReplayCartesian}
                  point={{
                    pixelSize: 8,
                    color: Color.YELLOW,
                    outlineColor: Color.WHITE,
                    outlineWidth: 2,
                  }}
                  label={{
                    text: '🪂',
                    font: '20px sans-serif',
                    pixelOffset: { x: 0, y: -20 } as any,
                  }}
                />
              )}

              {/* Camera Zoom to Track */}
              {positions.length > 0 && !isReplaying && (
                <CameraFlyTo
                  destination={positions[Math.floor(positions.length / 2)]}
                  duration={0}
                  offset={{
                    heading: 0,
                    pitch: -0.5,
                    range: 5000,
                  }}
                />
              )}

              {/* Camera Follow During Replay */}
              {isReplaying && currentReplayCartesian && (
                <CameraFlyTo
                  destination={currentReplayCartesian}
                  duration={0}
                  offset={{
                    heading: 0,
                    pitch: -0.5,
                    range: 1000,
                  }}
                />
              )}
            </Viewer>
          </div>

          {/* Loading State */}
          {gpxLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="text-white text-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p>Loading GPX data...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {gpxError && !isGPXNotAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 backdrop-blur-sm">
              <p className="text-red-700 font-semibold">⚠️ Failed to load flight data</p>
            </div>
          )}

          {/* Stats Panel */}
          {!gpxLoading && gpxData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50">
              <div className="flex flex-col">
                <span className="text-xs text-gray-600">Max Altitude:</span>
                <span className="text-lg font-bold text-gray-900">
                  {elevationProfile.maxAltitude.toLocaleString()} m
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-600">Elevation Gain:</span>
                <span className="text-lg font-bold text-gray-900">
                  {elevationProfile.elevationGain.toLocaleString()} m
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-600">Distance:</span>
                <span className="text-lg font-bold text-gray-900">
                  {elevationProfile.totalDistance.toFixed(1)} km
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-600">Duration:</span>
                <span className="text-lg font-bold text-gray-900">
                  {Math.floor(elevationProfile.duration / 3600)}h{' '}
                  {Math.floor((elevationProfile.duration % 3600) / 60)}m
                </span>
              </div>
            </div>
          )}

          {/* Elevation Profile Chart */}
          {showElevationChart && chartData.length > 0 && (
            <div className="p-4 bg-white rounded-b-xl">
              <h3 className="text-md font-semibold text-gray-900 mb-3">Elevation Profile</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="distance"
                    label={{ value: 'Distance (km)', position: 'insideBottomRight', offset: -5 }}
                  />
                  <YAxis
                    label={{
                      value: 'Elevation (m)',
                      angle: -90,
                      position: 'insideLeft',
                    }}
                  />
                  <Tooltip
                    formatter={(value) => `${value} m`}
                    labelFormatter={(label) => `${(label as number).toFixed(1)} km`}
                  />
                  <Line
                    type="monotone"
                    dataKey="elevation"
                    stroke="#8884d8"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default FlightViewer3D
