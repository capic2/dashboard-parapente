import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type VideoExportPhase =
  | 'queued'
  | 'running'
  | 'initializing'
  | 'capturing'
  | 'encoding'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type VideoExportStatusPayload = {
  job_id: string;
  status: string;
  internal_status?: string;
  render_method?: 'cpu' | 'gpu' | null;
  progress?: number;
  message?: string | null;
  error?: string | null;
  eta_seconds?: number;
  can_resume?: boolean;
  frames_captured?: number;
  resume_from_frame?: number | null;
  phase?: VideoExportPhase;
  log_tail?: string[];
};

type HookState = {
  status: VideoExportStatusPayload | null;
  isConnected: boolean;
};

const initialState: HookState = {
  status: null,
  isConnected: false,
};

const TERMINAL_STATUSES = new Set(['cancelled', 'completed', 'failed']);
const STATUS_POLL_INTERVAL_MS = 2000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');

export const toStatusPayload = (
  value: unknown
): VideoExportStatusPayload | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.job_id !== 'string' || typeof value.status !== 'string') {
    return null;
  }

  return {
    job_id: value.job_id,
    status: value.status,
    internal_status:
      typeof value.internal_status === 'string'
        ? value.internal_status
        : undefined,
    render_method:
      value.render_method === 'cpu' || value.render_method === 'gpu'
        ? value.render_method
        : undefined,
    progress: typeof value.progress === 'number' ? value.progress : undefined,
    message: typeof value.message === 'string' ? value.message : null,
    error: typeof value.error === 'string' ? value.error : null,
    eta_seconds:
      typeof value.eta_seconds === 'number'
        ? Math.max(0, value.eta_seconds)
        : undefined,
    can_resume:
      typeof value.can_resume === 'boolean' ? value.can_resume : undefined,
    frames_captured:
      typeof value.frames_captured === 'number'
        ? Math.max(0, value.frames_captured)
        : undefined,
    resume_from_frame:
      typeof value.resume_from_frame === 'number'
        ? Math.max(0, value.resume_from_frame)
        : null,
    phase:
      typeof value.phase === 'string'
        ? (value.phase as VideoExportPhase)
        : undefined,
    log_tail: Array.isArray(value.log_tail)
      ? value.log_tail.filter(
          (line): line is string => typeof line === 'string'
        )
      : undefined,
  };
};

export function formatEta(etaSeconds?: number): string | null {
  if (
    typeof etaSeconds !== 'number' ||
    !Number.isFinite(etaSeconds) ||
    etaSeconds < 0
  ) {
    return null;
  }

  if (etaSeconds < 60) {
    return '< 1 min';
  }

  const totalMinutes = Math.ceil(etaSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

export function useVideoExportStatus(
  jobId?: string | null,
  enabled = true,
  jobToken?: string | null
) {
  const [state, setState] = useState<HookState>(initialState);
  const polledStatus = useQuery({
    queryKey: ['video-export-status', jobId],
    queryFn: async () => {
      const payload = await api.get(`exports/${jobId}/status`).json<unknown>();
      const status = toStatusPayload(payload);
      if (!status) throw new Error('Invalid video export status response');
      return status;
    },
    enabled: enabled && Boolean(jobId) && !jobToken,
    refetchInterval: (query) => {
      const status = query.state.data;
      const currentStatus = status?.internal_status ?? status?.status;
      return currentStatus && TERMINAL_STATUSES.has(currentStatus)
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

    const path = `/api/job-access/exports/${jobId}/stream`;
    const streamUrl = new URL(path, window.location.origin);
    streamUrl.searchParams.set('access_token', jobToken);

    const eventSource = new EventSource(streamUrl.toString());

    const handleStatusEvent = (event: MessageEvent<string>) => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      const status = toStatusPayload(parsed);
      if (!status) {
        return;
      }

      setState({
        status,
        isConnected: true,
      });
    };

    const handleError = () => {
      setState((previous) => ({
        ...previous,
        isConnected: false,
      }));
    };

    eventSource.addEventListener('status', handleStatusEvent);
    eventSource.addEventListener('error', handleError);
    eventSource.onerror = handleError;

    return () => {
      eventSource.removeEventListener('status', handleStatusEvent);
      eventSource.removeEventListener('error', handleError);
      eventSource.close();
    };
  }, [enabled, jobId, jobToken]);

  if (!jobToken) {
    return {
      status: polledStatus.data ?? null,
      isConnected: polledStatus.isSuccess,
    };
  }

  return state;
}
