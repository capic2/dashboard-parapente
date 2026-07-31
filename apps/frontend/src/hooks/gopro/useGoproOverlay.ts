import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type GoproOverlayJob = {
  job_id: string;
  status:
    | 'queued'
    | 'preparing'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled';
  progress: number;
  message: string;
  error?: string | null;
  gpx_path?: string | null;
  layout_id: string;
  layout_label: string;
  output_filename: string;
  video_width?: number | null;
  video_height?: number | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  log_tail?: string[];
  job_token?: string | null;
};

export function useCreateFlightGoproOverlayJob(flightId: string) {
  return useMutation({
    mutationFn: async (formData: FormData) => {
      return await api
        .post(`flights/${flightId}/gopro-overlay`, {
          body: formData,
          timeout: false,
        })
        .json<GoproOverlayJob>();
    },
  });
}

const initialState = {
  job: null as GoproOverlayJob | null,
  isConnected: false,
};

const TERMINAL_STATUSES = new Set(['cancelled', 'completed', 'failed']);
const STATUS_POLL_INTERVAL_MS = 2000;

export function useGoproOverlayJobStream(
  jobId?: string | null,
  jobToken?: string | null,
  enabled = true
) {
  const [state, setState] = useState(initialState);
  const polledJob = useQuery({
    queryKey: ['gopro-overlay-job', jobId],
    queryFn: () =>
      api.get(`gopro-overlays/jobs/${jobId}/status`).json<GoproOverlayJob>(),
    enabled: enabled && Boolean(jobId) && !jobToken,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_STATUSES.has(status)
        ? false
        : STATUS_POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    setState(initialState);
    if (!enabled || !jobId || typeof window === 'undefined') {
      return;
    }

    if (!jobToken) return;

    const path = `/api/job-access/gopro-overlays/jobs/${jobId}/stream`;
    const url = new URL(path, window.location.origin);
    url.searchParams.set('access_token', jobToken);
    const eventSource = new EventSource(url.toString(), {
      withCredentials: true,
    });
    const onStatus = (event: MessageEvent<string>) => {
      try {
        setState({
          job: JSON.parse(event.data) as GoproOverlayJob,
          isConnected: true,
        });
      } catch {
        // Ignore malformed stream events.
      }
    };
    const onError = () => {
      setState((previous) => ({ ...previous, isConnected: false }));
    };

    eventSource.addEventListener('status', onStatus);
    eventSource.addEventListener('error', onError);
    eventSource.onerror = onError;
    return () => {
      eventSource.removeEventListener('status', onStatus);
      eventSource.removeEventListener('error', onError);
      eventSource.close();
    };
  }, [enabled, jobId, jobToken]);

  if (!jobToken) {
    return {
      job: polledJob.data ?? null,
      isConnected: polledJob.isSuccess,
    };
  }

  return state;
}
