import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface Site {
  id: string
  name: string
  code?: string
  orientation?: string
  camera_direction?: string  // Manual camera position override
  camera_distance?: number   // Camera distance in meters (default: 500)
  latitude?: number
  longitude?: number
  elevation_m?: number
  region?: string
  country?: string
}

export interface Flight {
  id: string
  name?: string
  title?: string
  site_id?: string
  flight_date: string
  departure_time?: string
  duration_minutes?: number
  max_altitude_m?: number
  max_speed_kmh?: number
  distance_km?: number
  elevation_gain_m?: number
  gpx_file_path?: string
  video_export_job_id?: string
  video_export_status?: 'processing' | 'completed' | 'failed' | null
  video_file_path?: string
  created_at: string
  updated_at: string
  site?: Site  // Include site details with orientation for camera positioning
}

/**
 * Fetch flight details including video export status
 */
export const useFlight = (flightId: string) => {
  return useQuery<Flight>({
    queryKey: ['flights', flightId],
    queryFn: async () => {
      const data: any = await api.get(`flights/${flightId}`).json()
      return data
    },
    enabled: !!flightId,
    staleTime: 1000 * 10, // 10 seconds - refresh frequently to check video status
    refetchInterval: (query) => {
      // Auto-refresh every 10 seconds if video is processing
      const data = query.state.data as Flight | undefined
      return data?.video_export_status === 'processing' ? 10000 : false
    },
  })
}
