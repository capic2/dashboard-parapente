/**
 * React Query hooks for Redis cache admin endpoints
 */

import {
  queryOptions,
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface CacheKeyInfo {
  key: string;
  ttl: number;
  size: number;
}

export interface CacheGroup {
  count: number;
  keys: CacheKeyInfo[];
}

export interface CacheOverview {
  total_keys: number;
  memory_usage: string | null;
  groups: Record<string, CacheGroup>;
}

export interface CacheKeyDetail {
  key: string;
  ttl: number;
  size: number;
  value: unknown;
  type: 'json' | 'string';
}

/**
 * Query options for cache overview (reusable in loader + component)
 */
export const cacheOverviewQueryOptions = () =>
  queryOptions({
    queryKey: ['admin-cache'],
    queryFn: async () => {
      return await api.get('admin/cache').json<CacheOverview>();
    },
  });

/**
 * Fetch cache overview (all keys grouped by prefix)
 */
export const useCacheOverview = (refetchInterval?: number) => {
  return useSuspenseQuery({
    ...cacheOverviewQueryOptions(),
    refetchInterval: refetchInterval || false,
  });
};

/**
 * Fetch detail for a specific cache key
 */
export const useCacheKeyDetail = (key: string | null) => {
  return useQuery({
    queryKey: ['admin-cache', key],
    queryFn: async () => {
      return await api
        .get(`admin/cache/${encodeURIComponent(key ?? '')}`)
        .json<CacheKeyDetail>();
    },
    enabled: key !== null,
  });
};

/**
 * Delete a single cache key or keys matching a pattern
 */
export const useDeleteCacheKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (key: string) => {
      return await api
        .delete(`admin/cache/${encodeURIComponent(key)}`)
        .json<{ success: boolean; keys_deleted: number }>();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cache'] });
    },
  });
};
