import React, { useEffect, useState } from 'react'
import { useCesiumViewer } from '../hooks/useCesiumViewer'
import { useFlightGPX, useFlightElevationProfile, useDownloadGPX } from '../hooks/useFlightGPX'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import './FlightViewer3D.css'

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
  const { viewerRef, isReady, isReplaying, addPolyline, playReplay, stopReplay, zoomToTrack } =
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
    <div className="flight-viewer-3d">
      <div className="viewer-header">
        <h2>🪂 {flightTitle || 'Flight View'}</h2>
        <div className="controls">
          {showReplay && (
            <div className="replay-controls">
              <label>
                Replay Speed (s):
                <input
                  type="number"
                  min="10"
                  max="120"
                  value={replayDuration}
                  onChange={(e) => setReplayDuration(Number(e.target.value))}
                  disabled={isReplaying}
                />
              </label>
              <button onClick={handlePlayReplay} disabled={!isReady || gpxLoading || isReplaying}>
                {isReplaying ? '⏸ Playing...' : '▶ Play Replay'}
              </button>
              {isReplaying && (
                <button onClick={stopReplay} className="stop-btn">
                  ⏹ Stop
                </button>
              )}
            </div>
          )}
          <button onClick={handleDownload} disabled={gpxLoading} className="download-btn">
            📥 Download GPX
          </button>
        </div>
      </div>

      {/* 3D Viewer Container */}
      <div id="cesium-container" className="cesium-container" ref={viewerRef} />

      {/* Loading State */}
      {gpxLoading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p>Loading GPX data...</p>
        </div>
      )}

      {/* Error State */}
      {gpxError && (
        <div className="error-overlay">
          <p>⚠️ Failed to load flight data</p>
        </div>
      )}

      {/* Stats Panel */}
      {!gpxLoading && gpxData && (
        <div className="stats-panel">
          <div className="stat-item">
            <span className="label">Max Altitude:</span>
            <span className="value">{elevationProfile.maxAltitude.toLocaleString()} m</span>
          </div>
          <div className="stat-item">
            <span className="label">Elevation Gain:</span>
            <span className="value">{elevationProfile.elevationGain.toLocaleString()} m</span>
          </div>
          <div className="stat-item">
            <span className="label">Distance:</span>
            <span className="value">{elevationProfile.totalDistance.toFixed(1)} km</span>
          </div>
          <div className="stat-item">
            <span className="label">Duration:</span>
            <span className="value">
              {Math.floor(elevationProfile.duration / 3600)}h{' '}
              {Math.floor((elevationProfile.duration % 3600) / 60)}m
            </span>
          </div>
        </div>
      )}

      {/* Elevation Profile Chart */}
      {showElevationChart && chartData.length > 0 && (
        <div className="elevation-chart">
          <h3>Elevation Profile</h3>
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
