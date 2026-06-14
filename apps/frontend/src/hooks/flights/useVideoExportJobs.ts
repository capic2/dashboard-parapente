import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../../lib/api';

export type VideoExportJob = {
  job_id: string;
  flight_id?: string | null;
  flight_name?: string | null;
  flight_title?: string | null;
  status: string;
  internal_status?: string | null;
  progress?: number | null;
  message?: string | null;
  error?: string | null;
  gpx_path?: string | null;
  mode?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  can_resume?: boolean;
  frames_captured?: number | null;
  resume_from_frame?: number | null;
  output_filename?: string | null;
  layout_label?: string | null;
  log_tail?: string[];
  has_output_file?: boolean;
  can_cancel: boolean;
  can_delete: boolean;
};

type VideoExportJobsResponse = {
  jobs: VideoExportJob[];
};

export type VideoExportTempCleanupResult = {
  files_deleted: number;
  dirs_deleted: number;
  bytes_deleted: number;
  paths_deleted: string[];
  errors: { path: string; error: string }[];
};

const videoExportJobsQueryKey = ['video-export-jobs'];

function toVideoExportJobsResponse(
  value: unknown
): VideoExportJobsResponse | null {
  if (!value || typeof value !== 'object' || !('jobs' in value)) {
    return null;
  }

  const jobs = (value as { jobs: unknown }).jobs;
  if (!Array.isArray(jobs)) {
    return null;
  }

  return { jobs: jobs as VideoExportJob[] };
}

export const videoExportJobsQueryOptions = () =>
  queryOptions<VideoExportJob[]>({
    queryKey: videoExportJobsQueryKey,
    queryFn: async () => {
      const data = await api
        .get('video-export-jobs')
        .json<VideoExportJobsResponse>();
      return data.jobs;
    },
  });

export function useVideoExportJobs() {
  const queryClient = useQueryClient();
  const query = useQuery(videoExportJobsQueryOptions());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const streamUrl = new URL(
      '/api/video-export-jobs/stream',
      window.location.origin
    );
    const eventSource = new EventSource(streamUrl.toString(), {
      withCredentials: true,
    });

    const handleJobsEvent = (event: MessageEvent<string>) => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      const data = toVideoExportJobsResponse(parsed);
      if (!data) {
        return;
      }

      queryClient.setQueryData(videoExportJobsQueryKey, data.jobs);
    };

    eventSource.addEventListener('jobs', handleJobsEvent);

    return () => {
      eventSource.removeEventListener('jobs', handleJobsEvent);
      eventSource.close();
    };
  }, [queryClient]);

  return query;
}

export function useCancelVideoExportJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      await api.delete(`exports/${jobId}/cancel`).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-export-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['flights'] });
    },
  });
}

export function useResumeVideoExportJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      await api.post(`exports/${jobId}/resume`).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-export-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['flights'] });
    },
  });
}

export function useDeleteVideoExportJobRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      await api.delete(`video-export-jobs/${jobId}`).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-export-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['flights'] });
    },
  });
}

export function useCleanupVideoExportTempFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await api
        .delete('video-export-jobs/temp-files')
        .json<VideoExportTempCleanupResult>();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-export-jobs'] });
    },
  });
}
