import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BackgroundOperationSchema,
  type BackgroundOperation,
} from '@dashboard-parapente/shared-types';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export const operationsQueryKey = ['background-operations'] as const;
const ACTIVE_STATUSES = new Set(['queued', 'running']);

function parseOperations(value: unknown): BackgroundOperation[] {
  const parsed = BackgroundOperationSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function operationsQueryOptions() {
  return {
    queryKey: operationsQueryKey,
    queryFn: async () =>
      parseOperations(await api.get('operations').json<unknown>()),
    refetchInterval: (query: { state: { data?: BackgroundOperation[] } }) => {
      const operations = query.state.data ?? [];
      return operations.some((operation) =>
        ACTIVE_STATUSES.has(operation.status)
      )
        ? 5000
        : 30000;
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always' as const,
  };
}

export function useOperations() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const query = useQuery({
    ...operationsQueryOptions(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined') return;

    const eventSource = new EventSource(
      new URL('/api/operations/stream', window.location.origin),
      { withCredentials: true }
    );
    const onOperations = (event: MessageEvent<string>) => {
      try {
        queryClient.setQueryData(
          operationsQueryKey,
          parseOperations(JSON.parse(event.data))
        );
      } catch {
        // Polling remains the recovery path for malformed or interrupted events.
      }
    };

    eventSource.addEventListener('operations', onOperations);
    return () => {
      eventSource.removeEventListener('operations', onOperations);
      eventSource.close();
    };
  }, [isAuthenticated, queryClient]);

  return query;
}

export function useMarkOperationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (operationId: string) =>
      api.patch(`operations/${operationId}/read`).json<unknown>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: operationsQueryKey });
    },
  });
}

export function useCancelOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (operationId: string) =>
      api.post(`operations/${operationId}/cancel`).json<unknown>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: operationsQueryKey });
    },
  });
}

export function useRetryOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (operationId: string) =>
      api.post(`operations/${operationId}/retry`).json<unknown>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: operationsQueryKey });
    },
  });
}
