import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { GeoPoint } from '../types/flight'

export interface GPXData {
  coordinates: GeoPoint[]
  max_altitude_m: number
  min_altitude_m: number
  elevation_gain_m: number
  elevation_loss_m: number
  total_distance_km: number
  flight_duration_seconds: number
}

/**
 * Fetch GPX data for a specific flight
 * Returns parsed coordinates and elevation profile
 */
export const useFlightGPX = (flightId: string) => {
  return useQuery<GPXData>({
    queryKey: ['flights', flightId, 'gpx'],
    queryFn: async () => {
      const data: any = await api.get(`flights/${flightId}/gpx-data`).json()
      return data.data
    },
    enabled: !!flightId,
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

/**
 * Download GPX file as attachment
 */
export const useDownloadGPX = () => {
  return async (flightId: string, fileName?: string) => {
    try {
      const blob = await api.get(`flights/${flightId}/gpx`).blob()

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName || `flight_${flightId}.gpx`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download GPX:', error)
      throw error
    }
  }
}

/**
 * Parse GPX file locally (for manual uploads)
 */
export const parseGPXFile = async (file: File): Promise<GeoPoint[]> => {
  const text = await file.text()
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(text, 'text/xml')

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid GPX file')
  }

  const trkpts = xmlDoc.querySelectorAll('trkpt')
  const coordinates: GeoPoint[] = []

  let timestamp = 0

  trkpts.forEach((trkpt) => {
    const lat = parseFloat(trkpt.getAttribute('lat') || '0')
    const lon = parseFloat(trkpt.getAttribute('lon') || '0')

    const eleElement = trkpt.querySelector('ele')
    const elevation = eleElement
      ? parseFloat(eleElement.textContent || '0')
      : 0

    const timeElement = trkpt.querySelector('time')
    if (timeElement && timeElement.textContent) {
      timestamp = new Date(timeElement.textContent).getTime()
    } else {
      timestamp += 1000 // Increment by 1 second if no timestamp
    }

    coordinates.push({
      lat,
      lon,
      elevation,
      timestamp,
    })
  })

  return coordinates
}

/**
 * Calculate elevation profile stats from coordinates
 */
export const calculateElevationStats = (coords: GeoPoint[]) => {
  if (coords.length === 0) {
    return {
      max_altitude_m: 0,
      min_altitude_m: 0,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
    }
  }

  let maxAlt = coords[0].elevation
  let minAlt = coords[0].elevation
  let elevationGain = 0
  let elevationLoss = 0

  for (let i = 1; i < coords.length; i++) {
    const prevElev = coords[i - 1].elevation
    const currElev = coords[i].elevation
    const diff = currElev - prevElev

    if (diff > 0) {
      elevationGain += diff
    } else {
      elevationLoss += Math.abs(diff)
    }

    maxAlt = Math.max(maxAlt, currElev)
    minAlt = Math.min(minAlt, currElev)
  }

  return {
    max_altitude_m: Math.round(maxAlt),
    min_altitude_m: Math.round(minAlt),
    elevation_gain_m: Math.round(elevationGain),
    elevation_loss_m: Math.round(elevationLoss),
  }
}

/**
 * Hook for flight elevation profile chart
 */
export const useFlightElevationProfile = (flightId: string) => {
  const { data: gpxData, isLoading } = useFlightGPX(flightId)

  return {
    data: gpxData?.coordinates || [],
    maxAltitude: gpxData?.max_altitude_m || 0,
    minAltitude: gpxData?.min_altitude_m || 0,
    elevationGain: gpxData?.elevation_gain_m || 0,
    elevationLoss: gpxData?.elevation_loss_m || 0,
    totalDistance: gpxData?.total_distance_km || 0,
    duration: gpxData?.flight_duration_seconds || 0,
    isLoading,
  }
}
