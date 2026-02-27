import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import axios, { type AxiosInstance } from 'axios'
import type { Flight, FlightFilters, FlightStats, FlightFormData, ApiResponse, Site } from '../types'
import {
  FlightsApiResponseSchema,
  FlightSchema,
  FlightStatsSchema,
  ApiResponseSchema,
} from '../schemas'

const API: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

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
  const queryParams = new URLSearchParams(
    Object.entries(filters).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = String(value)
      }
      return acc
    }, {} as Record<string, string>)
  ).toString()
  
  return useQuery({
    queryKey: ['flights', filters],
    queryFn: async () => {
      const response = await API.get(
        `/flights${queryParams ? `?${queryParams}` : ''}`
      )
      
      // Validate API response with Zod
      const validation = FlightsApiResponseSchema.safeParse(response.data)
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
      const response = await API.get<ApiResponse<Flight>>(`/flights/${flightId}`)
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(FlightSchema).safeParse(response.data)
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
      const response = await API.get('/flights/stats')
      
      // Validate API response with Zod
      const validation = FlightStatsSchema.safeParse(response.data)
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
 * Fetch statistics per site
 */
export const useSiteStats = (siteId: string | undefined): UseQueryResult<SiteStats, Error> => {
  return useQuery({
    queryKey: ['stats', 'sites', siteId],
    queryFn: async () => {
      if (!siteId) throw new Error('Site ID is required')
      const response = await API.get<ApiResponse<SiteStats>>(`/stats/sites/${siteId}`)
      return response.data.data
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
      const response = await API.post<ApiResponse<Flight>>('/flights', flightData)
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(FlightSchema).safeParse(response.data)
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
      const response = await API.patch<ApiResponse<Flight>>(`/flights/${flightId}`, flightData)
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(FlightSchema).safeParse(response.data)
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
      await API.delete(`/flights/${flightId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] })
      queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] })
    },
  })
}
