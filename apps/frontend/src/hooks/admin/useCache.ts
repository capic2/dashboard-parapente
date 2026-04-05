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
import { z } from 'zod';
import { api } from '../../lib/api';

// --- Zod schemas ---

const CacheKeyInfoSchema = z.object({
  key: z.string(),
  ttl: z.number(),
  size: z.number(),
});

const CacheGroupSchema = z.object({
  count: z.number(),
  keys: z.array(CacheKeyInfoSchema),
});

const CacheOverviewSchema = z.object({
  total_keys: z.number(),
  memory_usage: z.string().nullable(),
  groups: z.record(z.string(), CacheGroupSchema),
});

const CacheKeyDetailSchema = z.object({
  key: z.string(),
  ttl: z.number(),
  size: z.number(),
  value: z.unknown(),
  type: z.enum(['json', 'string']),
});

const DeleteCacheResponseSchema = z.object({
  success: z.boolean(),
  keys_deleted: z.number(),
});

// --- Inferred types ---

export type CacheKeyInfo = z.infer<typeof CacheKeyInfoSchema>;
export type CacheOverview = z.infer<typeof CacheOverviewSchema>;
export type CacheKeyDetail = z.infer<typeof CacheKeyDetailSchema>;

// --- Query options & hooks ---

/**
 * Query options for cache overview (reusable in loader + component)
 */
export const cacheOverviewQueryOptions = () =>
  queryOptions({
    queryKey: ['admin-cache'],
    queryFn: async () => {
      const data = await api.get('admin/cache').json();
      return CacheOverviewSchema.parse(data);
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
      const data = await api
        .get(`admin/cache/${encodeURIComponent(key ?? '')}`)
        .json();
      return CacheKeyDetailSchema.parse(data);
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
      const data = await api
        .delete(`admin/cache/${encodeURIComponent(key)}`)
        .json();
      return DeleteCacheResponseSchema.parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cache'] });
    },
  });
};
