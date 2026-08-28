import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  YoutubeVideoAssociationsSchema,
  type YoutubeVideoAssociation,
} from '@dashboard-parapente/shared-types';
import { api } from '../../lib/api';

export interface YoutubeConnectionStatus {
  configured: boolean;
  connected: boolean;
}

export interface YoutubeUploadJob {
  job_id: string;
  flight_id: string;
  source_type: 'gopro_overlay' | 'pano' | 'highlight';
  gopro_overlay_job_id?: string | null;
  highlight_video_job_id?: string | null;
  status: 'queued' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  youtube_url?: string | null;
  error?: string | null;
  updated_at?: string | null;
  log_tail: string[];
}

export type YoutubeUploadSource =
  | { source_type: 'gopro_overlay'; gopro_overlay_job_id: string }
  | { source_type: 'pano' }
  | { source_type: 'highlight'; highlight_video_job_id: string };

type YoutubeUploadInput = YoutubeUploadSource & {
  title: string;
  description: string;
  privacy_status: 'private' | 'unlisted' | 'public';
};

const sourceFromInput = (input: YoutubeUploadInput): YoutubeUploadSource => {
  if (input.source_type === 'pano') {
    return { source_type: 'pano' };
  }
  if (input.source_type === 'highlight') {
    return {
      source_type: 'highlight',
      highlight_video_job_id: input.highlight_video_job_id,
    };
  }
  return {
    source_type: 'gopro_overlay',
    gopro_overlay_job_id: input.gopro_overlay_job_id,
  };
};

export function useYoutubeStatus() {
  return useQuery({
    queryKey: ['youtube', 'status'],
    queryFn: () => api.get('youtube/status').json<YoutubeConnectionStatus>(),
    staleTime: 60_000,
  });
}

const youtubeUploadQueryKey = (
  flightId: string,
  source?: YoutubeUploadSource
) => ['youtube-upload', flightId, source ?? 'latest'];

export function useYoutubeUpload(
  flightId: string,
  source?: YoutubeUploadSource
) {
  return useQuery({
    queryKey: youtubeUploadQueryKey(flightId, source),
    queryFn: () =>
      api
        .get(`flights/${flightId}/youtube-upload`, {
          searchParams: source,
        })
        .json<YoutubeUploadJob | null>(),
    refetchInterval: (query) => {
      const job = query.state.data;
      return job?.status === 'queued' || job?.status === 'uploading'
        ? 3_000
        : false;
    },
  });
}

export const youtubeVideoAssociationsQueryKey = (flightId: string) => [
  'youtube-video-associations',
  flightId,
];

export function useYoutubeVideoAssociations(flightId: string) {
  return useQuery({
    queryKey: youtubeVideoAssociationsQueryKey(flightId),
    queryFn: async () => {
      const data = await api.get(`flights/${flightId}/youtube-videos`).json();
      return YoutubeVideoAssociationsSchema.parse(data);
    },
  });
}

export function useRemoveYoutubeVideoAssociation(flightId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      videoId,
      deleteFromYoutube,
    }: {
      videoId: YoutubeVideoAssociation['video_id'];
      deleteFromYoutube: boolean;
    }) => {
      await api.post(
        `flights/${flightId}/youtube-videos/${encodeURIComponent(videoId)}/remove`,
        { json: { delete_from_youtube: deleteFromYoutube } }
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['flights'] }),
        queryClient.invalidateQueries({ queryKey: ['flights', flightId] }),
        queryClient.invalidateQueries({
          queryKey: ['youtube-upload', flightId],
        }),
        queryClient.invalidateQueries({
          queryKey: youtubeVideoAssociationsQueryKey(flightId),
        }),
      ]);
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
    onSuccess: (job, input) => {
      queryClient.setQueryData(youtubeUploadQueryKey(flightId), job);
      queryClient.setQueryData(
        youtubeUploadQueryKey(flightId, sourceFromInput(input)),
        job
      );
      void queryClient.invalidateQueries({
        queryKey: ['video-export-jobs', 'active'],
      });
    },
  });
}

export function useCancelYoutubeUpload(flightId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetFlightId?: string) =>
      api
        .delete(`flights/${targetFlightId ?? flightId}/youtube-upload`)
        .json<YoutubeUploadJob>(),
    onSuccess: (job, targetFlightId) => {
      const resolvedFlightId = targetFlightId ?? flightId;
      queryClient.setQueryData(youtubeUploadQueryKey(resolvedFlightId), job);
      void queryClient.invalidateQueries({
        queryKey: ['video-export-jobs'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['youtube-upload', resolvedFlightId],
      });
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
