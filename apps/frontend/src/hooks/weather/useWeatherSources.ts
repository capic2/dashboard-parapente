/**
 * React Query hooks for Weather Source Configuration
 * Provides data fetching and mutations for weather sources
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  WeatherSource,
  WeatherSourceUpdate,
  WeatherSourceStats,
  WeatherSourceTestResult,
} from '../../types/weatherSources';

/**
 * Fetch all weather sources
 * @param enabledOnly - If true, only return enabled sources
 */
export const useWeatherSources = (enabledOnly = false) => {
  return useQuery({
    queryKey: ['weather-sources', enabledOnly],
    queryFn: async () => {
      const params = enabledOnly ? '?enabled_only=true' : '';
      return await api.get(`weather-sources${params}`).json<WeatherSource[]>();
    },
    staleTime: 30000, // 30 seconds
  });
};

/**
 * Fetch global weather source statistics
 */
export const useWeatherSourceStats = () => {
  return useQuery({
    queryKey: ['weather-sources', 'stats'],
    queryFn: async () => {
      return await api.get('weather-sources/stats').json<WeatherSourceStats>();
    },
    staleTime: 30000,
  });
};

/**
 * Update a weather source
 */
export const useUpdateWeatherSource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sourceName,
      data,
    }: {
      sourceName: string;
      data: WeatherSourceUpdate;
    }) => {
      return await api
        .patch(`weather-sources/${sourceName}`, { json: data })
        .json<WeatherSource>();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['weather-sources'] });
      queryClient.invalidateQueries({
        queryKey: ['weather-sources', variables.sourceName],
      });
    },
  });
};

/**
 * Delete a weather source
 */
export const useDeleteWeatherSource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceName: string) => {
      return await api
        .delete(`weather-sources/${sourceName}`)
        .json<{ success: boolean; message: string }>();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weather-sources'] });
    },
  });
};

/**
 * Test a weather source in real-time
 */
export const useTestWeatherSource = () => {
  return useMutation({
    mutationFn: async ({
      sourceName,
      lat,
      lon,
    }: {
      sourceName: string;
      lat: number;
      lon: number;
    }) => {
      return await api
        .post(`weather-sources/${sourceName}/test?lat=${lat}&lon=${lon}`)
        .json<WeatherSourceTestResult>();
    },
  });
};
