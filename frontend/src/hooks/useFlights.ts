import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Flight, FlightFilters, FlightStats, FlightFormData, ApiResponse, Site } from '../types'
import {
  FlightsApiResponseSchema,
  FlightSchema,
  FlightStatsSchema,
  ApiResponseSchema,
} from '../schemas'

interface SiteStats {
  site: Site
  total_flights: number
  total_duration_minutes: number
  avg_max_altitude_m: number
  avg_distance_km: number
}

/**
 * Fetch list of flights with optional filtering
 */
export const useFlights = (filters: FlightFilters = {}): UseQueryResult<Flight[], Error> => {
  const searchParams = Object.entries(filters).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = String(value)
    }
    return acc
  }, {} as Record<string, string>)
  
  return useQuery({
    queryKey: ['flights', filters],
    queryFn: async () => {
      const data = await api.get('flights', { searchParams }).json()
      
      // Validate API response with Zod
      const validation = FlightsApiResponseSchema.safeParse(data)
      if (!validation.success) {
        console.error('❌ Flights validation failed:', validation.error)
        throw new Error(`Invalid flights data: ${validation.error.message}`)
      }
      
      return validation.data.flights
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

/**
 * Fetch single flight details
 */
export const useFlight = (flightId: string | undefined): UseQueryResult<Flight, Error> => {
  return useQuery({
    queryKey: ['flights', flightId],
    queryFn: async () => {
      if (!flightId) throw new Error('Flight ID is required')
      const data = await api.get(`flights/${flightId}`).json()
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(FlightSchema).safeParse(data)
      if (!validation.success) {
        console.error('❌ Flight validation failed:', validation.error)
        throw new Error(`Invalid flight data: ${validation.error.message}`)
      }
      
      return validation.data.data
    },
    enabled: !!flightId,
    staleTime: 1000 * 60 * 30,
  })
}

/**
 * Fetch learning statistics
 */
export const useFlightStats = (): UseQueryResult<FlightStats, Error> => {
  return useQuery({
    queryKey: ['flights', 'stats'],
    queryFn: async () => {
      const data = await api.get('flights/stats').json()
      
      // Validate API response with Zod
      const validation = FlightStatsSchema.safeParse(data)
      if (!validation.success) {
        console.error('❌ Flight stats validation failed:', validation.error)
        throw new Error(`Invalid flight stats: ${validation.error.message}`)
      }
      
      return validation.data
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

/**
 * Flight record for a specific metric
 */
interface FlightRecord {
  value: number
  flight_id: string
  flight_name: string
  date: string
  site_name: string | null
  site_id: string | null
}

/**
 * Personal flight records (longest, highest, fastest, farthest)
 */
export interface FlightRecords {
  longest_duration: FlightRecord | null
  highest_altitude: FlightRecord | null
  longest_distance: FlightRecord | null
  max_speed: FlightRecord | null
}

/**
 * Fetch personal flight records
 */
export const useFlightRecords = (): UseQueryResult<FlightRecords, Error> => {
  return useQuery({
    queryKey: ['flights', 'records'],
    queryFn: async () => {
      const data = await api.get('flights/records').json()
      return data as FlightRecords
    },
    staleTime: 1000 * 60 * 60, // 1 hour - records don't change often
  })
}

/**
 * Fetch statistics per site
 */
export const useSiteStats = (siteId: string | undefined): UseQueryResult<SiteStats, Error> => {
  return useQuery({
    queryKey: ['stats', 'sites', siteId],
    queryFn: async () => {
      if (!siteId) throw new Error('Site ID is required')
      const data: ApiResponse<SiteStats> = await api.get(`stats/sites/${siteId}`).json()
      return data.data
    },
    enabled: !!siteId,
    staleTime: 1000 * 60 * 60,
  })
}

/**
 * Create new flight (manual entry)
 */
export const useCreateFlight = (): UseMutationResult<Flight, Error, FlightFormData> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (flightData: FlightFormData) => {
      const data = await api.post('flights', { json: flightData }).json()
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(FlightSchema).safeParse(data)
      if (!validation.success) {
        console.error('❌ Create flight validation failed:', validation.error)
        throw new Error(`Invalid flight creation response: ${validation.error.message}`)
      }
      
      return validation.data.data
    },
    onSuccess: () => {
      // Invalidate flights query to refetch
      queryClient.invalidateQueries({ queryKey: ['flights'] })
      queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] })
    },
  })
}

/**
 * Update existing flight
 */
export const useUpdateFlight = (flightId: string | undefined): UseMutationResult<Flight, Error, FlightFormData> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (flightData: FlightFormData) => {
      if (!flightId) throw new Error('Flight ID is required')
      const data = await api.patch(`flights/${flightId}`, { json: flightData }).json()
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(FlightSchema).safeParse(data)
      if (!validation.success) {
        console.error('❌ Update flight validation failed:', validation.error)
        throw new Error(`Invalid flight update response: ${validation.error.message}`)
      }
      
      return validation.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] })
      if (flightId) {
        queryClient.invalidateQueries({ queryKey: ['flights', flightId] })
      }
    },
  })
}

/**
 * Delete flight
 */
export const useDeleteFlight = (flightId: string | undefined): UseMutationResult<void, Error, void> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!flightId) throw new Error('Flight ID is required')
      await api.delete(`flights/${flightId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] })
      queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] })
    },
  })
}

/**
 * Synchroniser les vols Strava pour une période donnée
 */
export function useStravaSyncMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ date_from, date_to }: { date_from: string; date_to: string }) => {
      const data = await api.post('flights/sync-strava', { 
        json: { date_from, date_to } 
      }).json<{
        success: boolean;
        imported: number;
        skipped: number;
        failed: number;
        flights: any[];
      }>();
      return data;
    },
    onSuccess: () => {
      // Invalider le cache des vols pour forcer le refresh
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });
    }
  });
}

/**
 * Créer un nouveau vol à partir d'un fichier GPX
 * Parse le GPX, extrait les stats et crée le vol automatiquement
 */
export function useCreateFlightFromGPX() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (formData: FormData) => {
      // Ky supporte FormData directement
      const data = await api.post('flights/create-from-gpx', { 
        body: formData 
      }).json<{
        success: boolean;
        flight: Flight;
        message: string;
      }>();
      return data;
    },
    onSuccess: () => {
      // Invalider le cache pour rafraîchir la liste et les stats
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['flights', 'records'] });
    }
  });
}

/**
 * Uploader un GPX sur un vol existant (pour visualisation Cesium)
 * Ne modifie pas les stats du vol, juste ajoute le fichier
 */
export function useUploadGPXToFlight(flightId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (formData: FormData) => {
      // Ky supporte FormData directement
      const data = await api.post(`flights/${flightId}/upload-gpx`, { 
        body: formData 
      }).json<{
        success: boolean;
        flight_id: string;
        gpx_file_path: string;
        message: string;
      }>();
      return data;
    },
    onSuccess: () => {
      // Invalider le cache du vol spécifique ET la liste
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['flights', flightId] });
    }
  });
}
