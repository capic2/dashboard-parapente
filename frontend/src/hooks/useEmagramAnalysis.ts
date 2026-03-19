/**
 * React Query hooks for Emagram Analysis API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EmagramAnalysis, EmagramListItem, EmagramTriggerRequest } from '../types/emagram';

const API_BASE = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8001` : 'http://localhost:8001');

// Query keys
export const emagramKeys = {
  all: ['emagram'] as const,
  latest: (lat: number, lon: number) => ['emagram', 'latest', lat, lon] as const,
  history: (lat: number, lon: number, days: number) => ['emagram', 'history', lat, lon, days] as const,
};

/**
 * Fetch latest emagram analysis for user location
 */
export function useLatestEmagram(
  userLat: number | null,
  userLon: number | null,
  maxDistanceKm: number = 200,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: emagramKeys.latest(userLat || 0, userLon || 0),
    queryFn: async (): Promise<EmagramAnalysis | null> => {
      if (userLat === null || userLon === null) {
        return null;
      }

      const url = new URL(`${API_BASE}/api/emagram/latest`);
      url.searchParams.set('user_lat', userLat.toString());
      url.searchParams.set('user_lon', userLon.toString());
      url.searchParams.set('max_distance_km', maxDistanceKm.toString());

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Failed to fetch latest emagram: ${response.statusText}`);
      }

      const data = await response.json();
      return data; // null if no recent analysis
    },
    enabled: userLat !== null && userLon !== null && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

/**
 * Fetch emagram analysis history
 */
export function useEmagramHistory(
  userLat: number | null,
  userLon: number | null,
  days: number = 7,
  maxDistanceKm: number = 200,
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
        throw new Error(`Failed to fetch emagram history: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: userLat !== null && userLon !== null && (options?.enabled !== false),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Trigger manual emagram analysis
 */
export function useTriggerEmagram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: EmagramTriggerRequest): Promise<EmagramAnalysis> => {
      const response = await fetch(`${API_BASE}/api/emagram/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to trigger emagram analysis');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate and refetch latest emagram
      queryClient.invalidateQueries({ queryKey: emagramKeys.all });
    },
  });
}
