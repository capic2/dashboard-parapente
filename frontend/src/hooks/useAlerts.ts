import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import axios, { type AxiosInstance } from 'axios'
import type { Alert, AlertHistory, AlertFormData, ApiResponse } from '../types'
import {
  AlertSchema,
  AlertHistorySchema,
  ApiResponseSchema,
} from '../schemas'

const API: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Fetch user's alerts
 */
export const useAlerts = (): UseQueryResult<Alert[], Error> => {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const response = await API.get<ApiResponse<Alert[]>>('/alerts')
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(AlertSchema.array()).safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Alerts validation failed:', validation.error)
        throw new Error(`Invalid alerts data: ${validation.error.message}`)
      }
      
      return validation.data.data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Fetch single alert
 */
export const useAlert = (alertId: string | undefined): UseQueryResult<Alert, Error> => {
  return useQuery({
    queryKey: ['alerts', alertId],
    queryFn: async () => {
      if (!alertId) throw new Error('Alert ID is required')
      const response = await API.get<ApiResponse<Alert>>(`/alerts/${alertId}`)
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(AlertSchema).safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Alert validation failed:', validation.error)
        throw new Error(`Invalid alert data: ${validation.error.message}`)
      }
      
      return validation.data.data
    },
    enabled: !!alertId,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Fetch alert trigger history
 */
export const useAlertHistory = (): UseQueryResult<AlertHistory[], Error> => {
  return useQuery({
    queryKey: ['alerts', 'history'],
    queryFn: async () => {
      const response = await API.get<ApiResponse<AlertHistory[]>>('/alerts/history')
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(AlertHistorySchema.array()).safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Alert history validation failed:', validation.error)
        throw new Error(`Invalid alert history data: ${validation.error.message}`)
      }
      
      return validation.data.data
    },
    staleTime: 1000 * 60 * 10,
  })
}

/**
 * Create new alert
 */
export const useCreateAlert = (): UseMutationResult<Alert, Error, AlertFormData> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (alertData: AlertFormData) => {
      const response = await API.post<ApiResponse<Alert>>('/alerts', alertData)
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(AlertSchema).safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Create alert validation failed:', validation.error)
        throw new Error(`Invalid alert creation response: ${validation.error.message}`)
      }
      
      return validation.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}

/**
 * Update alert
 */
export const useUpdateAlert = (alertId: string | undefined): UseMutationResult<Alert, Error, AlertFormData> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (alertData: AlertFormData) => {
      if (!alertId) throw new Error('Alert ID is required')
      const response = await API.patch<ApiResponse<Alert>>(`/alerts/${alertId}`, alertData)
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(AlertSchema).safeParse(response.data)
      if (!validation.success) {
        console.error('❌ Update alert validation failed:', validation.error)
        throw new Error(`Invalid alert update response: ${validation.error.message}`)
      }
      
      return validation.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      if (alertId) {
        queryClient.invalidateQueries({ queryKey: ['alerts', alertId] })
      }
    },
  })
}

/**
 * Delete alert
 */
export const useDeleteAlert = (alertId: string | undefined): UseMutationResult<void, Error, void> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!alertId) throw new Error('Alert ID is required')
      await API.delete(`/alerts/${alertId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alerts', 'history'] })
    },
  })
}
