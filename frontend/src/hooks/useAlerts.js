import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const API = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Fetch user's alerts
 */
export const useAlerts = () => {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const response = await API.get('/alerts')
      return response.data.data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Fetch single alert
 * @param {string} alertId - Alert ID
 */
export const useAlert = (alertId) => {
  return useQuery({
    queryKey: ['alerts', alertId],
    queryFn: async () => {
      const response = await API.get(`/alerts/${alertId}`)
      return response.data.data
    },
    enabled: !!alertId,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Fetch alert trigger history
 */
export const useAlertHistory = () => {
  return useQuery({
    queryKey: ['alerts', 'history'],
    queryFn: async () => {
      const response = await API.get('/alerts/history')
      return response.data.data
    },
    staleTime: 1000 * 60 * 10,
  })
}

/**
 * Create new alert
 */
export const useCreateAlert = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (alertData) => {
      const response = await API.post('/alerts', alertData)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}

/**
 * Update alert
 */
export const useUpdateAlert = (alertId) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (alertData) => {
      const response = await API.patch(`/alerts/${alertId}`, alertData)
      return response.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alerts', alertId] })
    },
  })
}

/**
 * Delete alert
 */
export const useDeleteAlert = (alertId) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await API.delete(`/alerts/${alertId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alerts', 'history'] })
    },
  })
}
