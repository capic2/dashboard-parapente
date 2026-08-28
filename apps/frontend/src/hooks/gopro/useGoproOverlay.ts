import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { GoproOverlayJob } from '@dashboard-parapente/shared-types';
import { api } from '../../lib/api';
import type { GeoPoint } from '../../types/flight';

export type { GoproOverlayJob } from '@dashboard-parapente/shared-types';

export type GoproOverlayPreview = {
  video: {
    duration_seconds: number;
    start_time: string;
    preview_target_end_seconds: number;
    preview_segments: {
      preview_start_seconds: number;
      source_start_seconds: number;
      duration_seconds: number;
    }[];
    preview_status: 'missing' | 'generating' | 'ready' | 'failed';
    preview_available_duration_seconds: number;
    preview_requested_duration_seconds: number;
    preview_max_duration_seconds: number;
    preview_error?: string | null;
  };
  gpx: {
    start_time: string;
    end_time: string;
    duration_seconds: number;
    coordinates: GeoPoint[];
  };
  alignment: {
    automatic_offset_seconds: number;
    manual_offset_seconds: number;
    effective_offset_seconds: number;
  };
};

export function goproPreviewRefetchInterval(
  status?: GoproOverlayPreview['video']['preview_status']
) {
  if (status === 'generating') return 2000;
  if (status === 'missing') return 30_000;
  return false;
}

export function useGoproOverlayPreview(flightId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['flights', flightId, 'gopro-overlay-preview'],
    queryFn: () =>
      api
        .get(`flights/${flightId}/gopro-overlay/preview`)
        .json<GoproOverlayPreview>(),
    enabled,
    refetchInterval: (query) =>
      goproPreviewRefetchInterval(query.state.data?.video.preview_status),
  });
}

export function useGenerateGoproPreview(flightId: string) {
  return useMutation({
    mutationFn: ({
      durationSeconds,
      targetEndSeconds,
    }: {
      durationSeconds: number;
      targetEndSeconds: number;
    }) =>
      api
        .post(`flights/${flightId}/gopro-camera/preview`, {
          json: {
            duration_seconds: durationSeconds,
            target_end_seconds: targetEndSeconds,
          },
        })
        .json(),
  });
}

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
