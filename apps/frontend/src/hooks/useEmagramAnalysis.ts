/**
 * React Query hooks for Emagram Analysis API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EmagramAnalysis, EmagramListItem } from '../types/emagram';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8001`
    : 'http://localhost:8001');

const emagramKeys = {
  all: ['emagram'] as const,
  latest: (siteId: string, dayIndex: number) =>
    ['emagram', 'latest', siteId, dayIndex] as const,
  history: (lat: number, lon: number, days: number) =>
    ['emagram', 'history', lat, lon, days] as const,
};

/**
 * Fetch latest emagram analysis for a site and day
 */
export function useLatestEmagram(
  siteId: string,
  dayIndex = 0,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: emagramKeys.latest(siteId, dayIndex),
    queryFn: async (): Promise<EmagramAnalysis | null> => {
      if (!siteId) return null;

      const url = new URL(`${API_BASE}/api/emagram/latest`);
      url.searchParams.set('site_id', siteId);
      url.searchParams.set('day_index', dayIndex.toString());
      url.searchParams.set('auto_analyze', 'true');

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(
          `Failed to fetch latest emagram: ${response.statusText}`
        );
      }

      return response.json();
    },
    enabled: !!siteId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) =>
      query.state.data ? 10 * 60 * 1000 : 30 * 1000,
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

      const url = new URL(`${API_BASE}/api/emagram/history`);
      url.searchParams.set('user_lat', userLat.toString());
      url.searchParams.set('user_lon', userLon.toString());
      url.searchParams.set('days', days.toString());
      url.searchParams.set('max_distance_km', maxDistanceKm.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(
          `Failed to fetch emagram history: ${response.statusText}`
        );
      }

      return response.json();
    },
    enabled:
      userLat !== null && userLon !== null && (options?.enabled !== false),
    staleTime: 10 * 60 * 1000,
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
    }): Promise<EmagramAnalysis> => {
      const response = await fetch(`${API_BASE}/api/emagram/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.detail || 'Failed to trigger emagram analysis'
        );
      }

      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emagramKeys.all });
    },
  });
}
