import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import axios, { type AxiosInstance } from 'axios'
import type { Flight, FlightFilters, FlightStats, FlightFormData, ApiResponse, Site } from '../types'

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
      const response = await API.get<ApiResponse<Flight[]>>(
        `/flights${queryParams ? `?${queryParams}` : ''}`
      )
      return response.data.data
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
      return response.data.data
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
      const response = await API.get<ApiResponse<FlightStats>>('/flights/stats')
      return response.data.data
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
      return response.data.data
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
      return response.data.data
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
