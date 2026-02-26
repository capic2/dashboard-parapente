import { useForm } from '@tanstack/react-form'
import { useCreateAlert, useUpdateAlert } from './useAlerts'

/**
 * Hook for alert form management using TanStack Form
 * Handles validation, submission, and error handling
 */
export const useAlertForm = (initialAlert = null) => {
  const createAlert = useCreateAlert()
  const updateAlert = useUpdateAlert(initialAlert?.id)

  const form = useForm({
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
    onSubmit: async (values) => {
      try {
        if (initialAlert) {
          await updateAlert.mutateAsync(values)
        } else {
          await createAlert.mutateAsync(values)
        }
      } catch (error) {
        form.setFieldMeta('name', {
          ...form.getFieldMeta('name'),
          errors: [error.message],
        })
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
export const useFlightForm = (initialFlight = null) => {
  const form = useForm({
    defaultValues: {
      title: initialFlight?.title ?? '',
      site_id: initialFlight?.site_id ?? '',
      flight_date: initialFlight?.flight_date ?? new Date().toISOString().split('T')[0],
      duration_minutes: initialFlight?.duration_minutes ?? 0,
      max_altitude_m: initialFlight?.max_altitude_m ?? 0,
      distance_km: initialFlight?.distance_km ?? 0,
      elevation_gain_m: initialFlight?.elevation_gain_m ?? 0,
      notes: initialFlight?.notes ?? '',
    },
  })

  return form
}
