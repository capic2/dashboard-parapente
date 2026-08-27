import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HighlightVideoJobSchema } from '@dashboard-parapente/shared-types';
import { api } from '../../lib/api';

export function useFlightHighlightVideos(flightId: string) {
  return useQuery({
    queryKey: ['flights', flightId, 'highlight-videos'],
    queryFn: async () => {
      const payload = await api
        .get(`flights/${flightId}/highlight-videos`)
        .json<unknown>();
      return HighlightVideoJobSchema.array().parse(payload);
    },
    enabled: Boolean(flightId),
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      return jobs.some(
        (job) => job.status === 'queued' || job.status === 'running'
      )
        ? 5000
        : false;
    },
  });
}

export function useCreateFlightHighlightVideo(flightId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const payload = await api
        .post(`flights/${flightId}/highlight-videos`)
        .json<unknown>();
      return HighlightVideoJobSchema.parse(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['flights', flightId, 'highlight-videos'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['flights', 'summaries'],
      });
    },
  });
}

export function useCancelFlightHighlightVideo(flightId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const payload = await api
        .delete(`flights/${flightId}/highlight-videos/${jobId}/cancel`)
        .json<unknown>();
      return HighlightVideoJobSchema.parse(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['flights', flightId, 'highlight-videos'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['flights', 'summaries'],
      });
    },
  });
}

export function useDeleteFlightHighlightVideo(flightId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) =>
      api
        .delete(`flights/${flightId}/highlight-videos/${jobId}`)
        .json<unknown>(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['flights', flightId, 'highlight-videos'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['flights', 'summaries'],
      });
    },
  });
}
