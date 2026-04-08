/**
 * React Query hooks for Emagram Analysis API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStaleTime, getWeatherRefetchInterval } from '../../lib/cacheConfig';
import { EmagramAnalysis, EmagramListItem } from '../../types/emagram';
import { api } from '../../lib/api';

const emagramKeys = {
  all: ['emagram'] as const,
  latest: (siteId: string, dayIndex: number, hour?: number | null) =>
    ['emagram', 'latest', siteId, dayIndex, hour ?? 'any'] as const,
  hours: (siteId: string, dayIndex: number) =>
    ['emagram', 'hours', siteId, dayIndex] as const,
  history: (lat: number, lon: number, days: number) =>
    ['emagram', 'history', lat, lon, days] as const,
};

/**
 * Fetch latest emagram analysis for a site and day
 */
export function useLatestEmagram(
  siteId: string,
  dayIndex = 0,
  hour?: number | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: emagramKeys.latest(siteId, dayIndex, hour),
    queryFn: async (): Promise<EmagramAnalysis | null> => {
      if (!siteId) return null;

      const params = new URLSearchParams({
        site_id: siteId,
        day_index: dayIndex.toString(),
        auto_analyze: 'true',
      });
      if (hour != null) {
        params.set('hour', hour.toString());
      }

      return api.get(`emagram/latest?${params}`).json<EmagramAnalysis | null>();
    },
    enabled: !!siteId && options?.enabled !== false,
    staleTime: getStaleTime(5 * 60 * 1000),
    refetchInterval: (query) =>
      getWeatherRefetchInterval(query.state.data ? 10 * 60 * 1000 : 30 * 1000),
  });
}

export interface EmagramHourEntry {
  hour: number;
  score: number | null;
  status: string;
  id: string;
}

export interface EmagramHoursResponse {
  site_id: string;
  forecast_date: string;
  hours: EmagramHourEntry[];
}

/**
 * Fetch available hourly emagram analyses for slider
 */
export function useEmagramHours(
  siteId: string,
  dayIndex = 0,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: emagramKeys.hours(siteId, dayIndex),
    queryFn: async (): Promise<EmagramHoursResponse> => {
      const params = new URLSearchParams({
        site_id: siteId,
        day_index: dayIndex.toString(),
      });

      return api.get(`emagram/hours?${params}`).json<EmagramHoursResponse>();
    },
    enabled: !!siteId && options?.enabled !== false,
    staleTime: getStaleTime(2 * 60 * 1000),
    refetchInterval: (query) =>
      getWeatherRefetchInterval(
        query.state.data?.hours?.length ? 5 * 60 * 1000 : 30 * 1000
      ),
  });
}

/**
 * Fetch emagram analysis history
 */
export function useEmagramHistory(
  userLat: number | null,
  userLon: number | null,
  days = 7,
  maxDistanceKm = 200,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: emagramKeys.history(userLat || 0, userLon || 0, days),
    queryFn: async (): Promise<EmagramListItem[]> => {
      if (userLat === null || userLon === null) {
        return [];
      }

      const params = new URLSearchParams({
        user_lat: userLat.toString(),
        user_lon: userLon.toString(),
        days: days.toString(),
        max_distance_km: maxDistanceKm.toString(),
      });

      return api.get(`emagram/history?${params}`).json<EmagramListItem[]>();
    },
    enabled: userLat !== null && userLon !== null && options?.enabled !== false,
    staleTime: getStaleTime(10 * 60 * 1000),
  });
}

/**
 * Trigger manual emagram analysis for a site
 */
export function useTriggerEmagram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: {
      site_id?: string;
      user_latitude?: number;
      user_longitude?: number;
      force_refresh?: boolean;
      day_index?: number;
      hour?: number | null;
    }): Promise<EmagramAnalysis> => {
      return api
        .post('emagram/analyze', { json: request })
        .json<EmagramAnalysis>();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emagramKeys.all });
    },
  });
}
