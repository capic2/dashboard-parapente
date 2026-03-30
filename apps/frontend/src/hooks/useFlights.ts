import {
  queryOptions,
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {api} from '../lib/api';
import type {Flight, FlightFilters, FlightFormData, FlightRecords, FlightStats,} from '../types';
import {
  ApiResponseSchema,
  FlightRecordsSchema,
  FlightsApiResponseSchema,
  FlightSchema,
  FlightStatsSchema,
} from '@dashboard-parapente/shared-types';
import {HTTPError} from 'ky';

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
    staleTime: 1000 * 60 * 10,
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
    staleTime: 1000 * 60 * 60,
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
    staleTime: 1000 * 60 * 60,
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


/**
 * Synchroniser les vols Strava pour une période donnée
 */
export function useStravaSyncMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      date_from,
      date_to,
    }: {
      date_from: string;
      date_to: string;
    }) => {
      const data = await api
        .post('flights/sync-strava', {
          json: { date_from, date_to },
        })
        .json<{
          success: boolean;
          imported: number;
          skipped: number;
          failed: number;
          flights: unknown[];
        }>();
      return data;
    },
    onSuccess: () => {
      // Invalider le cache des vols pour forcer le refresh
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });
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
        const data = await api
          .post('flights/create-from-gpx', {
            body: formData,
          })
          .json<{
            success: boolean;
            flight: Flight;
            message: string;
          }>();
        return data;
      } catch (error) {
        // Handle HTTPError from ky
        if (error instanceof HTTPError) {
          let errorMessage = 'Erreur lors de la création du vol';
          try {
            const errorData = (await error.response.json()) as {
              message?: string;
              error?: string;
            };
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // Response is not JSON, use default message
          }
          throw new Error(errorMessage);
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
