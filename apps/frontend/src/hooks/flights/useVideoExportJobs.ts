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
  total_frames?: number | null;
  fps?: number | null;
  fps_actual?: number | null;
  eta_seconds?: number | null;
  message?: string | null;
  error?: string | null;
  render_method?: 'cpu' | 'gpu' | null;
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
  source_type?: string | null;
  youtube_url?: string | null;
  log_tail?: string[];
  has_output_file?: boolean;
  can_cancel: boolean;
  can_delete: boolean;
};

export const VIDEO_EXPORT_JOBS_PAGE_SIZE = 25;
const VIDEO_EXPORT_JOBS_REFRESH_INTERVAL_MS = 3000;

export type VideoExportJobsPage = {
  jobs: VideoExportJob[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
};

type VideoExportJobsResponse = {
  jobs: VideoExportJob[];
  page?: number;
  page_size?: number;
  total?: number;
  total_pages?: number;
  status_counts?: Record<string, number>;
  type_counts?: Record<string, number>;
};

export type VideoExportJobsFilters = {
  statusFilter?: string;
  typeFilter?: string;
};

export type VideoExportTempCleanupResult = {
  files_deleted: number;
  dirs_deleted: number;
  bytes_deleted: number;
  paths_deleted: string[];
  errors: { path: string; error: string }[];
};

export type VideoExportOutputKind = 'video' | 'gopro';

export type VideoExportGpuStatus = {
  available: boolean;
  driver?: string;
  devices: {
    name: string;
    utilization_percent: number;
    memory_used_mb: number;
    memory_total_mb: number;
  }[];
};

const VIDEO_EXPORT_GPU_REFRESH_INTERVAL_MS = 5000;

export const videoExportGpuStatusQueryOptions = () =>
  queryOptions<VideoExportGpuStatus>({
    queryKey: ['video-export-gpu-status'],
    queryFn: () => api.get('video-export-gpu-status').json<VideoExportGpuStatus>(),
    refetchInterval: VIDEO_EXPORT_GPU_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
  });

export function useVideoExportGpuStatus() {
  return useQuery(videoExportGpuStatusQueryOptions());
}

const videoExportJobsQueryKey = ['video-export-jobs'];

function videoExportJobsQueryKeyFor(
  page: number,
  pageSize: number,
  statusFilter: string,
  typeFilter: string
) {
  return [...videoExportJobsQueryKey, page, pageSize, statusFilter, typeFilter];
}

function toVideoExportJobsResponse(value: unknown): VideoExportJobsPage | null {
  if (!value || typeof value !== 'object' || !('jobs' in value)) {
    return null;
  }

  const jobs = (value as { jobs: unknown }).jobs;
  if (!Array.isArray(jobs)) {
    return null;
  }

  const response = value as Partial<VideoExportJobsResponse>;
  const page = response.page ?? 1;
  const pageSize = response.page_size ?? VIDEO_EXPORT_JOBS_PAGE_SIZE;
  const total = response.total ?? jobs.length;
  return {
    jobs: jobs as VideoExportJob[],
    page,
    pageSize,
    total,
    totalPages:
      response.total_pages ?? Math.max(1, Math.ceil(total / pageSize)),
    statusCounts: response.status_counts ?? {},
    typeCounts: response.type_counts ?? {},
  };
}

export const videoExportJobsQueryOptions = ({
  page = 1,
  pageSize = VIDEO_EXPORT_JOBS_PAGE_SIZE,
  statusFilter = 'all',
  typeFilter = 'all',
}: { page?: number; pageSize?: number } & VideoExportJobsFilters = {}) =>
  queryOptions<VideoExportJobsPage>({
    queryKey: videoExportJobsQueryKeyFor(
      page,
      pageSize,
      statusFilter,
      typeFilter
    ),
    queryFn: async () => {
      const data = await api
        .get('video-export-jobs', {
          searchParams: {
            page: String(page),
            page_size: String(pageSize),
            status_filter: statusFilter,
            type_filter: typeFilter,
          },
        })
        .json<VideoExportJobsResponse>();
      return toVideoExportJobsResponse(data) as VideoExportJobsPage;
    },
    // EventSource cannot attach the bearer token used by the protected API.
    // Keep polling as a reliable fallback so the infrastructure table updates
    // even when the SSE connection is rejected by authentication or a proxy.
    refetchInterval: VIDEO_EXPORT_JOBS_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: 'always',
  });

export function useVideoExportJobs({
  page = 1,
  pageSize = VIDEO_EXPORT_JOBS_PAGE_SIZE,
  statusFilter = 'all',
  typeFilter = 'all',
}: { page?: number; pageSize?: number } & VideoExportJobsFilters = {}) {
  const queryClient = useQueryClient();
  const query = useQuery(
    videoExportJobsQueryOptions({ page, pageSize, statusFilter, typeFilter })
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const streamUrl = new URL(
      '/api/video-export-jobs/stream',
      window.location.origin
    );
    streamUrl.searchParams.set('page', String(page));
    streamUrl.searchParams.set('page_size', String(pageSize));
    streamUrl.searchParams.set('status_filter', statusFilter);
    streamUrl.searchParams.set('type_filter', typeFilter);
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

      queryClient.setQueryData(
        videoExportJobsQueryKeyFor(page, pageSize, statusFilter, typeFilter),
        data
      );
    };

    eventSource.addEventListener('jobs', handleJobsEvent);

    return () => {
      eventSource.removeEventListener('jobs', handleJobsEvent);
      eventSource.close();
    };
  }, [page, pageSize, queryClient, statusFilter, typeFilter]);

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

export function useDeleteVideoExportOutput() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      kind,
    }: {
      jobId: string;
      kind: VideoExportOutputKind;
    }) => {
      const endpoint =
        kind === 'gopro'
          ? `gopro-overlays/jobs/${jobId}/video`
          : `exports/${jobId}/video`;
      await api.delete(endpoint).json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['video-export-jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['flights'] });
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
