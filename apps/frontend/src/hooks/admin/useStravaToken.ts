/**
 * React Query hooks for Strava token management endpoints
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../lib/api';

// --- Zod schemas ---

const TokenStatusSchema = z.object({
  valid: z.boolean(),
  expires_at: z.string().nullable(),
});

const TokenRefreshResponseSchema = TokenStatusSchema.extend({
  refreshed: z.boolean(),
});

const TokenLogSchema = z.object({
  id: z.number(),
  timestamp: z.string(),
  success: z.boolean(),
  message: z.string().nullable(),
  expires_at: z.string().nullable(),
});

// --- Inferred types ---

export type TokenLog = z.infer<typeof TokenLogSchema>;

// --- Hooks ---

export const useStravaTokenStatus = () => {
  return useQuery({
    queryKey: ['admin-strava-token-status'],
    queryFn: async () => {
      const data = await api.get('admin/strava/token-status').json();
      return TokenStatusSchema.parse(data);
    },
    refetchInterval: 60_000,
  });
};

export const useStravaTokenLogs = (limit = 20) => {
  return useQuery({
    queryKey: ['admin-strava-token-logs', limit],
    queryFn: async () => {
      const data = await api
        .get('admin/strava/token-logs', { searchParams: { limit } })
        .json();
      return z.array(TokenLogSchema).parse(data);
    },
  });
};

export const useStravaRefreshToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await api.post('admin/strava/refresh-token').json();
      return TokenRefreshResponseSchema.parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-strava-token-status'],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-strava-token-logs'] });
    },
  });
};
