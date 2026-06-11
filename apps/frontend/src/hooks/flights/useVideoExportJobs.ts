import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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

const hasActiveJob = (jobs: VideoExportJob[] | undefined) =>
  Boolean(jobs?.some((job) => job.can_cancel));

export const videoExportJobsQueryOptions = () =>
  queryOptions<VideoExportJob[]>({
    queryKey: ['video-export-jobs'],
    queryFn: async () => {
      const data = await api
        .get('video-export-jobs')
        .json<VideoExportJobsResponse>();
      return data.jobs;
    },
    refetchInterval: (query) => (hasActiveJob(query.state.data) ? 3000 : false),
  });

export function useVideoExportJobs() {
  return useQuery(videoExportJobsQueryOptions());
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
