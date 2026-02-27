import { useForm } from '@tanstack/react-form'
import { useCreateAlert, useUpdateAlert } from './useAlerts'
import type { Alert, AlertFormData } from '../types'

/**
 * Hook for alert form management using TanStack Form
 * Handles validation, submission, and error handling
 */
export const useAlertForm = (initialAlert: Alert | null = null) => {
  const createAlert = useCreateAlert()
  const updateAlert = useUpdateAlert(initialAlert?.id)

  const form = useForm<AlertFormData>({
    defaultValues: {
      name: initialAlert?.name ?? '',
      site_id: initialAlert?.site_id ?? '',
      condition_type: initialAlert?.condition_type ?? 'wind',
      operator: initialAlert?.operator ?? '>',
      threshold_min: initialAlert?.threshold_min ?? 0,
      threshold_max: initialAlert?.threshold_max ?? 100,
      is_active: initialAlert?.is_active ?? true,
      notify_via: initialAlert?.notify_via ?? 'telegram',
    },
    onSubmit: async ({ value }) => {
      try {
        if (initialAlert) {
          await updateAlert.mutateAsync(value)
        } else {
          await createAlert.mutateAsync(value)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Form submission error:', errorMessage)
      }
    },
  })

  return {
    form,
    isLoading: createAlert.isPending || updateAlert.isPending,
    error: createAlert.error || updateAlert.error,
  }
}

/**
 * Hook for flight form management
 */
export const useFlightForm = (initialFlight: Partial<Alert> | null = null) => {
  const form = useForm({
    defaultValues: {
      title: initialFlight?.name ?? '',
      site_id: initialFlight?.site_id ?? '',
      flight_date: new Date().toISOString().split('T')[0],
      duration_minutes: 0,
      max_altitude_m: 0,
      distance_km: 0,
      elevation_gain_m: 0,
      notes: '',
    },
  })

  return form
}
