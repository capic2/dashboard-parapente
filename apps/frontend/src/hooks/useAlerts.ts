import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Alert, AlertHistory, AlertFormData, ApiResponse } from '../types'
import {
  AlertSchema,
  AlertHistorySchema,
  ApiResponseSchema,
} from '@dashboard-parapente/shared-types'

/**
 * Fetch user's alerts
 */
export const useAlerts = (): UseQueryResult<Alert[], Error> => {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const data: ApiResponse<Alert[]> = await api.get('alerts').json()
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(AlertSchema.array()).safeParse(data)
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
      const data: ApiResponse<Alert> = await api.get(`alerts/${alertId}`).json()
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(AlertSchema).safeParse(data)
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
      const data: ApiResponse<AlertHistory[]> = await api.get('alerts/history').json()
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(AlertHistorySchema.array()).safeParse(data)
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
      const data: ApiResponse<Alert> = await api.post('alerts', { json: alertData }).json()
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(AlertSchema).safeParse(data)
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
      const data: ApiResponse<Alert> = await api.patch(`alerts/${alertId}`, { json: alertData }).json()
      
      // Validate API response with Zod
      const validation = ApiResponseSchema(AlertSchema).safeParse(data)
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
      await api.delete(`alerts/${alertId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alerts', 'history'] })
    },
  })
}
