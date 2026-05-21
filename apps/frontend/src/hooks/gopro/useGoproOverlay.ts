import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
  layout_id: string;
  layout_label: string;
  output_filename: string;
  video_width?: number | null;
  video_height?: number | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
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

export function useGoproOverlayJobStream(
  jobId?: string | null,
  jobToken?: string | null
) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(initialState);
    if (!jobId || typeof window === 'undefined') {
      return;
    }

    const path = jobToken
      ? `/api/job-access/gopro-overlays/jobs/${jobId}/stream`
      : `/api/gopro-overlays/jobs/${jobId}/stream`;
    const url = new URL(path, window.location.origin);
    if (jobToken) {
      url.searchParams.set('access_token', jobToken);
    }
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
  }, [jobId, jobToken]);

  return state;
}
