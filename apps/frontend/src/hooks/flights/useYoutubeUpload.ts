import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface YoutubeConnectionStatus {
  configured: boolean;
  connected: boolean;
}

export interface YoutubeUploadJob {
  job_id: string;
  flight_id: string;
  status: 'queued' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  youtube_url?: string | null;
  error?: string | null;
}

interface YoutubeUploadInput {
  title: string;
  description: string;
  privacy_status: 'private' | 'unlisted' | 'public';
}

export function useYoutubeStatus() {
  return useQuery({
    queryKey: ['youtube', 'status'],
    queryFn: () => api.get('youtube/status').json<YoutubeConnectionStatus>(),
    staleTime: 60_000,
  });
}

export function useYoutubeUpload(flightId: string) {
  return useQuery({
    queryKey: ['youtube-upload', flightId],
    queryFn: () =>
      api
        .get(`flights/${flightId}/youtube-upload`)
        .json<YoutubeUploadJob | null>(),
    refetchInterval: (query) => {
      const job = query.state.data;
      return job?.status === 'queued' || job?.status === 'uploading'
        ? 3_000
        : false;
    },
  });
}

export function useStartYoutubeUpload(flightId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: YoutubeUploadInput) =>
      api
        .post(`flights/${flightId}/youtube-upload`, { json: payload })
        .json<YoutubeUploadJob>(),
    onSuccess: (job) => {
      queryClient.setQueryData(['youtube-upload', flightId], job);
    },
  });
}

export function useCancelYoutubeUpload(flightId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete(`flights/${flightId}/youtube-upload`).json<YoutubeUploadJob>(),
    onSuccess: (job) => {
      queryClient.setQueryData(['youtube-upload', flightId], job);
    },
  });
}

export function useYoutubeAuthorizationUrl() {
  return useMutation({
    mutationFn: (returnTo: string) =>
      api
        .post('youtube/auth-url', { json: { return_to: returnTo } })
        .json<{ authorization_url: string }>(),
  });
}
