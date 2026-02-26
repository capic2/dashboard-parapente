import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const API = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Fetch list of flights with optional filtering
 * @param {object} filters - Optional filters (siteId, dateFrom, dateTo, limit)
 */
export const useFlights = (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString()
  
  return useQuery({
    queryKey: ['flights', filters],
    queryFn: async () => {
      const response = await API.get(
        `/flights${queryParams ? `?${queryParams}` : ''}`
      )
      return response.data.data
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

/**
 * Fetch single flight details
 * @param {string} flightId - Flight ID
 */
export const useFlight = (flightId) => {
  return useQuery({
    queryKey: ['flights', flightId],
    queryFn: async () => {
      const response = await API.get(`/flights/${flightId}`)
      return response.data.data
    },
    enabled: !!flightId,
    staleTime: 1000 * 60 * 30,
  })
}

/**
 * Fetch learning statistics
 */
export const useFlightStats = () => {
  return useQuery({
    queryKey: ['flights', 'stats'],
    queryFn: async () => {
      const response = await API.get('/flights/stats')
      return response.data.data
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

/**
 * Fetch statistics per site
 * @param {string} siteId - Site ID
 */
export const useSiteStats = (siteId) => {
  return useQuery({
    queryKey: ['stats', 'sites', siteId],
    queryFn: async () => {
      const response = await API.get(`/stats/sites/${siteId}`)
      return response.data.data
    },
    enabled: !!siteId,
    staleTime: 1000 * 60 * 60,
  })
}

/**
 * Create new flight (manual entry)
 */
export const useCreateFlight = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (flightData) => {
      const response = await API.post('/flights', flightData)
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
export const useUpdateFlight = (flightId) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (flightData) => {
      const response = await API.patch(`/flights/${flightId}`, flightData)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] })
      queryClient.invalidateQueries({ queryKey: ['flights', flightId] })
    },
  })
}

/**
 * Delete flight
 */
export const useDeleteFlight = (flightId) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await API.delete(`/flights/${flightId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] })
      queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] })
    },
  })
}
