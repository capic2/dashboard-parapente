import {
  queryOptions,
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api, getApiErrorMessage } from '../../lib/api';
import type {
  Flight,
  FlightFilters,
  FlightFormData,
  FlightRecords,
  FlightStats,
} from '../../types';
import {
  ApiResponseSchema,
  FlightRecordsSchema,
  FlightsApiResponseSchema,
  FlightSchema,
  FlightStatsSchema,
  VIDEO_EXPORT_IN_PROGRESS_STATUSES,
} from '@dashboard-parapente/shared-types';
import { isHTTPError } from 'ky';
import i18n from 'i18next';
import { z } from 'zod';
import { getStaleTime } from '../../lib/cacheConfig';
import { isGoproOverlayInProgress } from '../../lib/flightMediaState';

const isMediaExportInProgress = (flight: Flight) =>
  Boolean(
    (flight.video_export_status &&
      VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(flight.video_export_status)) ||
    isGoproOverlayInProgress(flight.gopro_overlay_status)
  );

export const flightsQueryOptions = (filters: FlightFilters = {}) => {
  const searchParams = Object.entries(filters).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = String(value);
      }
      return acc;
    },
    {} as Record<string, string>
  );

  return queryOptions<Flight[]>({
    queryKey: ['flights', filters],
    queryFn: async () => {
      const data = await api.get('flights', { searchParams }).json();
      const validation = FlightsApiResponseSchema.safeParse(data);
      if (!validation.success) {
        throw new Error(`Invalid flights data: ${validation.error.message}`);
      }
      return validation.data.flights;
    },
    staleTime: getStaleTime(1000 * 60 * 10),
    refetchInterval: (query) => {
      const data = query.state.data as Flight[] | undefined;
      return data?.some(isMediaExportInProgress) ? 10000 : false;
    },
  });
};

export const flightStatsQueryOptions = () =>
  queryOptions<FlightStats>({
    queryKey: ['flights', 'stats'],
    queryFn: async () => {
      const data = await api.get('flights/stats').json();
      const validation = FlightStatsSchema.safeParse(data);
      if (!validation.success) {
        throw new Error(`Invalid flight stats: ${validation.error.message}`);
      }
      return validation.data;
    },
    staleTime: getStaleTime(1000 * 60 * 60),
  });

export const flightRecordsQueryOptions = () =>
  queryOptions<FlightRecords>({
    queryKey: ['flights', 'records'],
    queryFn: async () => {
      const data = await api.get('flights/records').json();
      const validation = FlightRecordsSchema.safeParse(data);
      if (!validation.success) {
        throw new Error(`Invalid flight records: ${validation.error.message}`);
      }
      return validation.data;
    },
    staleTime: getStaleTime(1000 * 60 * 60),
  });

/**
 * Fetch list of flights with optional filtering
 */
export const useFlights = (
  filters: FlightFilters = {}
): UseQueryResult<Flight[], Error> => {
  return useQuery(flightsQueryOptions(filters));
};

/**
 * Fetch learning statistics
 */
export const useFlightStats = (): UseQueryResult<FlightStats, Error> => {
  return useQuery(flightStatsQueryOptions());
};

/**
 * Fetch personal flight records
 */
export const useFlightRecords = (): UseQueryResult<FlightRecords, Error> => {
  return useQuery(flightRecordsQueryOptions());
};

/**
 * Update existing flight
 */
export const useUpdateFlight = (
  flightId: string | undefined
): UseMutationResult<Flight, Error, FlightFormData> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flightData: FlightFormData) => {
      if (!flightId) throw new Error('Flight ID is required');
      const data = await api
        .patch(`flights/${flightId}`, { json: flightData })
        .json();

      // Validate API response with Zod
      const validation = ApiResponseSchema(FlightSchema).safeParse(data);
      if (!validation.success) {
        console.error('❌ Update flight validation failed:', validation.error);
        throw new Error(
          `Invalid flight update response: ${validation.error.message}`
        );
      }

      return validation.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      if (flightId) {
        queryClient.invalidateQueries({ queryKey: ['flights', flightId] });
      }
    },
  });
};

/** Create a flight from manually entered information. */
export function useCreateFlight() {
  const queryClient = useQueryClient();

  return useMutation<Flight, Error, FlightFormData>({
    mutationFn: async (flightData) => {
      let data: unknown;
      try {
        data = await api.post('flights', { json: flightData }).json();
      } catch (error) {
        if (error instanceof Error) {
          error.message = await getApiErrorMessage(
            error,
            i18n.t('flights.createGenericError')
          );
        }
        throw error;
      }

      const validation = FlightSchema.safeParse(data);
      if (!validation.success) {
        throw new Error(
          `Invalid flight creation response: ${validation.error.message}`
        );
      }
      return validation.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flights'] });
      void queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['flights', 'records'] });
    },
  });
}

const IntervalsSyncResponseSchema = z.object({
  success: z.boolean(),
  imported: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  flights: z.array(
    z.object({
      id: z.string(),
      external_provider: z.string(),
      external_activity_id: z.string(),
      name: z.string(),
      date: z.string(),
    })
  ),
});

const IntervalsActivitySchema = z.object({
  id: z.string(),
  start_date_local: z.string(),
  type: z.string(),
  name: z.string(),
  source: z.string(),
  file_type: z.string(),
});

const IntervalsPreviewResponseSchema = z.object({
  activities: z.array(IntervalsActivitySchema),
  activity_types: z.array(z.string()),
});

export type IntervalsSyncResponse = z.infer<typeof IntervalsSyncResponseSchema>;

export function useIntervalsSyncMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    IntervalsSyncResponse,
    Error,
    { date_from: string; date_to: string }
  >({
    mutationFn: async ({
      date_from,
      date_to,
    }: {
      date_from: string;
      date_to: string;
    }) => {
      let data: unknown;
      try {
        data = await api
          .post('flights/sync-intervals', {
            json: { date_from, date_to },
          })
          .json();
      } catch (error) {
        if (error instanceof Error) {
          error.message = await getApiErrorMessage(
            error,
            i18n.t('intervals.syncError')
          );
        }
        throw error;
      }

      const validation = IntervalsSyncResponseSchema.safeParse(data);
      if (!validation.success) {
        // oxlint-disable-next-line no-console
        console.error('Invalid Intervals.icu sync response', validation.error);
        throw new Error(i18n.t('intervals.invalidResponse'));
      }
      if (!validation.data.success) {
        throw new Error(i18n.t('intervals.syncError'));
      }
      return validation.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flights'] });
      void queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['flights', 'records'] });
    },
  });
}

export function useIntervalsPreview(
  dateFrom: string,
  dateTo: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['flights', 'sync-intervals', 'preview', dateFrom, dateTo],
    enabled: enabled && Boolean(dateFrom && dateTo && dateFrom <= dateTo),
    queryFn: async () => {
      let data: unknown;
      try {
        data = await api
          .get('flights/sync-intervals/preview', {
            searchParams: { date_from: dateFrom, date_to: dateTo },
          })
          .json();
      } catch (error) {
        if (error instanceof Error) {
          error.message = await getApiErrorMessage(
            error,
            i18n.t('intervals.previewError')
          );
        }
        throw error;
      }

      const validation = IntervalsPreviewResponseSchema.safeParse(data);
      if (!validation.success) {
        // oxlint-disable-next-line no-console
        console.error(
          'Invalid Intervals.icu preview response',
          validation.error
        );
        throw new Error(i18n.t('intervals.invalidPreviewResponse'));
      }
      return validation.data;
    },
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
      try {
        // Ky supporte FormData directement
        return await api
          .post('flights/create-from-gpx', {
            body: formData,
          })
          .json<{
            success: boolean;
            flight: Flight;
            message: string;
          }>();
      } catch (error) {
        // Handle HTTPError from ky
        if (isHTTPError<{ error: string; message: string }>(error)) {
          let errorMessage = 'Erreur lors de la création du vol';
          try {
            errorMessage =
              typeof error.data === 'string'
                ? error.data
                : error.data?.message || error.data?.error || errorMessage;
          } catch {
            // Response is not JSON, use default message
          }
          // @ts-expect-error IDK
          throw new Error(errorMessage, { cause: error });
        }
        // Re-throw other errors
        throw error;
      }
    },
    onSuccess: () => {
      // Invalider le cache pour rafraîchir la liste et les stats
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['flights', 'records'] });
    },
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
      const data = await api
        .post(`flights/${flightId}/upload-gpx`, {
          body: formData,
        })
        .json<{
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
    },
  });
}
