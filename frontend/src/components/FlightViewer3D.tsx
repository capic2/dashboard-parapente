import React, { useEffect, useState } from 'react'
import { useCesiumViewer } from '../hooks/useCesiumViewer'
import { useFlightGPX, useFlightElevationProfile, useDownloadGPX } from '../hooks/useFlightGPX'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface FlightViewer3DProps {
  flightId: string
  flightTitle?: string
  showReplay?: boolean
  showElevationChart?: boolean
}

/**
 * 3D Flight Viewer with Cesium
 * Displays track on 3D map, elevation profile, and replay controls
 */
export const FlightViewer3D: React.FC<FlightViewer3DProps> = ({
  flightId,
  flightTitle,
  showReplay = true,
  showElevationChart = true,
}) => {
  const { isReady, isReplaying, addPolyline, playReplay, stopReplay, zoomToTrack } =
    useCesiumViewer()
  const { data: gpxData, isLoading: gpxLoading, error: gpxError } = useFlightGPX(flightId)
  const elevationProfile = useFlightElevationProfile(flightId)
  const downloadGPX = useDownloadGPX()
  const [replayDuration, setReplayDuration] = useState(30)

  // Draw track when GPX data loads
  useEffect(() => {
    if (isReady && gpxData?.coordinates && gpxData.coordinates.length > 0) {
      addPolyline(gpxData.coordinates)
      zoomToTrack()
    }
  }, [isReady, gpxData, addPolyline, zoomToTrack])

  const handlePlayReplay = () => {
    if (gpxData?.coordinates) {
      playReplay(gpxData.coordinates, replayDuration)
    }
  }

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

  return (
    <div className="relative">
      <div className="bg-white p-4 rounded-t-xl border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-3">🪂 {flightTitle || 'Flight View'}</h2>
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
                disabled={!isReady || gpxLoading || isReplaying}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReplaying ? '⏸ Playing...' : '▶ Play Replay'}
              </button>
              {isReplaying && (
                <button 
                  onClick={stopReplay}
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

      {/* 3D Viewer Container */}
      <div id="cesium-container" className="w-full h-[600px] bg-gray-900" />

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
      {gpxError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 backdrop-blur-sm">
          <p className="text-red-700 font-semibold">⚠️ Failed to load flight data</p>
        </div>
      )}

      {/* Stats Panel */}
      {!gpxLoading && gpxData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50">
          <div className="flex flex-col">
            <span className="text-xs text-gray-600">Max Altitude:</span>
            <span className="text-lg font-bold text-gray-900">{elevationProfile.maxAltitude.toLocaleString()} m</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-600">Elevation Gain:</span>
            <span className="text-lg font-bold text-gray-900">{elevationProfile.elevationGain.toLocaleString()} m</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-600">Distance:</span>
            <span className="text-lg font-bold text-gray-900">{elevationProfile.totalDistance.toFixed(1)} km</span>
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
    </div>
  )
}

export default FlightViewer3D
