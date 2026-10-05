/**
 * useBestSpotAPI Hook
 *
 * Fetches the best spot recommendation from the backend API
 * The backend calculates the best spot based on:
 * 1. Para-Index scores from all sites
 * 2. Wind favorability matching
 * 3. Results are cached for 60 minutes (aligned with scheduler)
 *
 * Updated to support day_index parameter for fetching best spot for different days
 */

import { useQuery, queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';
import type { CurrentLocation } from '../useCurrentLocation';
import { DEFAULT_BEST_SPOT_RADIUS_KM } from '../useBestSpotRadius';
import {
  HourlyBestSpotsResultSchema,
  BestSpotResultSchema,
  type BestSpotResult,
  type HourlyBestSpotsResult,
} from '@dashboard-parapente/shared-types';

const forecastHourFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  hour: 'numeric',
  hourCycle: 'h23',
});

const getCurrentForecastHour = () =>
  Number.parseInt(forecastHourFormatter.format(new Date()), 10);

export const bestSpotQueryOptions = (
  dayIndex = 0,
  location?: CurrentLocation | null,
  radiusKm = DEFAULT_BEST_SPOT_RADIUS_KM,
  enabled = true
) =>
  queryOptions<BestSpotResult>({
    queryKey: [
      'bestSpot',
      dayIndex,
      location?.latitude ?? null,
      location?.longitude ?? null,
      radiusKm,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        day_index: dayIndex.toString(),
        radius_km: radiusKm.toString(),
      });
      if (location) {
        params.set('latitude', location.latitude.toString());
        params.set('longitude', location.longitude.toString());
      }
      const response = await api.get(`spots/best?${params}`).json();
      return BestSpotResultSchema.parse(response);
    },
    enabled,
    staleTime: getStaleTime(1000 * 60 * 60),
    gcTime: 1000 * 60 * 60 * 2,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

export const hourlyBestSpotsQueryOptions = (
  dayIndex = 0,
  hours = 24,
  location?: CurrentLocation | null,
  radiusKm = DEFAULT_BEST_SPOT_RADIUS_KM,
  enabled = true
) => {
  const currentHour = dayIndex === 0 ? getCurrentForecastHour() : null;

  return queryOptions<HourlyBestSpotsResult>({
    queryKey: [
      'bestSpot',
      'hourly',
      dayIndex,
      hours,
      currentHour,
      location?.latitude ?? null,
      location?.longitude ?? null,
      radiusKm,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        day_index: dayIndex.toString(),
        hours: hours.toString(),
        radius_km: radiusKm.toString(),
      });
      if (location) {
        params.set('latitude', location.latitude.toString());
        params.set('longitude', location.longitude.toString());
      }
      const response = await api.get(`spots/best/hourly?${params}`).json();
      return HourlyBestSpotsResultSchema.parse(response);
    },
    enabled,
    staleTime: getStaleTime(1000 * 60 * 30),
    refetchInterval: dayIndex === 0 ? 60_000 : false,
    refetchOnWindowFocus: dayIndex === 0 ? 'always' : false,
    gcTime: 1000 * 60 * 60 * 2,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

/**
 * Hook to fetch the best spot for a specific day
 * @param dayIndex - Day index (0 = today, 1 = tomorrow, ..., 6 = in 6 days)
 * @returns Query result with the best spot data
 */
export function useBestSpotAPI(
  dayIndex = 0,
  location?: CurrentLocation | null,
  radiusKm = DEFAULT_BEST_SPOT_RADIUS_KM,
  enabled = true
) {
  return useQuery(bestSpotQueryOptions(dayIndex, location, radiusKm, enabled));
}

export function useHourlyBestSpotsAPI(
  dayIndex = 0,
  hours = 24,
  location?: CurrentLocation | null,
  radiusKm = DEFAULT_BEST_SPOT_RADIUS_KM,
  enabled = true
) {
  return useQuery(
    hourlyBestSpotsQueryOptions(dayIndex, hours, location, radiusKm, enabled)
  );
}

// Re-export the type for convenience
export type {
  BestSpotResult,
  HourlyBestSpotsResult,
} from '@dashboard-parapente/shared-types';
