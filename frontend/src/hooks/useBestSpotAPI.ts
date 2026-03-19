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
import { BestSpotResultSchema, type BestSpotResult } from '../schemas';

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
      const response = await api
        .get(`spots/best?${params}`)
        .json();
      
      // Validate response with Zod schema
      return BestSpotResultSchema.parse(response);
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

// Re-export the type for convenience
export type { BestSpotResult } from '../schemas';
