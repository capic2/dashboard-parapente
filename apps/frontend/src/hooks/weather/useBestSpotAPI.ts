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
import {
  HourlyBestSpotsResultSchema,
  BestSpotResultSchema,
  type BestSpotResult,
  type HourlyBestSpotsResult,
} from '@dashboard-parapente/shared-types';

export const bestSpotQueryOptions = (dayIndex = 0) =>
  queryOptions<BestSpotResult>({
    queryKey: ['bestSpot', dayIndex],
    queryFn: async () => {
      const params = new URLSearchParams({ day_index: dayIndex.toString() });
      const response = await api.get(`spots/best?${params}`).json();
      return BestSpotResultSchema.parse(response);
    },
    staleTime: getStaleTime(1000 * 60 * 60),
    gcTime: 1000 * 60 * 60 * 2,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

export const hourlyBestSpotsQueryOptions = (dayIndex = 0, hours = 24) =>
  queryOptions<HourlyBestSpotsResult>({
    queryKey: ['bestSpot', 'hourly', dayIndex, hours],
    queryFn: async () => {
      const params = new URLSearchParams({
        day_index: dayIndex.toString(),
        hours: hours.toString(),
      });
      const response = await api.get(`spots/best/hourly?${params}`).json();
      return HourlyBestSpotsResultSchema.parse(response);
    },
    staleTime: getStaleTime(1000 * 60 * 30),
    gcTime: 1000 * 60 * 60 * 2,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

/**
 * Hook to fetch the best spot for a specific day
 * @param dayIndex - Day index (0 = today, 1 = tomorrow, ..., 6 = in 6 days)
 * @returns Query result with the best spot data
 */
export function useBestSpotAPI(dayIndex = 0) {
  return useQuery(bestSpotQueryOptions(dayIndex));
}

export function useHourlyBestSpotsAPI(dayIndex = 0, hours = 24) {
  return useQuery(hourlyBestSpotsQueryOptions(dayIndex, hours));
}

// Re-export the type for convenience
export type {
  BestSpotResult,
  HourlyBestSpotsResult,
} from '@dashboard-parapente/shared-types';
