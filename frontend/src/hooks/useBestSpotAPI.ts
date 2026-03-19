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

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface ApiBestSpotResponse {
  site: {
    id: string;
    code: string;
    name: string;
    latitude: number;
    longitude: number;
    orientation?: string;
    rating?: number;
  };
  paraIndex: number;
  windDirection?: string;
  windSpeed?: number;
  windFavorability: 'good' | 'moderate' | 'bad';
  score: number;
  reason: string;
  verdict?: string;
}

export interface BestSpotResult {
  site: ApiBestSpotResponse['site'];
  paraIndex: number;
  windDirection?: string;
  windSpeed?: number;
  windFavorability: 'good' | 'moderate' | 'bad';
  score: number;
  reason: string;
  verdict?: string;
}

/**
 * Hook to fetch the best spot for a specific day
 * @param dayIndex - Day index (0 = today, 1 = tomorrow, ..., 6 = in 6 days)
 * @returns Query result with the best spot data
 */
export function useBestSpotAPI(dayIndex: number = 0) {
  return useQuery<BestSpotResult, Error>({
    queryKey: ['bestSpot', dayIndex],
    queryFn: async () => {
      const params = new URLSearchParams({ day_index: dayIndex.toString() });
      const data: ApiBestSpotResponse = await api
        .get(`spots/best?${params}`)
        .json();
      
      // Return data in BestSpotResult format (already matches)
      return data as BestSpotResult;
    },
    staleTime: 1000 * 60 * 60, // 60 minutes (aligned with backend cache)
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Get just the best site ID for a specific day (useful for auto-selecting on dashboard)
 * @param dayIndex - Day index (0-6)
 * @returns Site ID or null
 */
export function useBestSiteIdAPI(dayIndex: number = 0): string | null {
  const { data: bestSpot } = useBestSpotAPI(dayIndex);
  return bestSpot?.site?.id || null;
}
