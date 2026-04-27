import { useEffect, useState } from 'react';

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
  progress?: number;
  message?: string | null;
  eta_seconds?: number;
  phase?: VideoExportPhase;
};

type HookState = {
  status: VideoExportStatusPayload | null;
  isConnected: boolean;
};

const initialState: HookState = {
  status: null,
  isConnected: false,
};

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
    progress: typeof value.progress === 'number' ? value.progress : undefined,
    message: typeof value.message === 'string' ? value.message : null,
    eta_seconds:
      typeof value.eta_seconds === 'number'
        ? Math.max(0, value.eta_seconds)
        : undefined,
    phase:
      typeof value.phase === 'string'
        ? (value.phase as VideoExportPhase)
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

export function useVideoExportStatus(jobId?: string | null, enabled = true) {
  const [state, setState] = useState<HookState>(initialState);

  useEffect(() => {
    setState(initialState);

    if (!enabled || !jobId || typeof window === 'undefined') {
      return;
    }

    const eventSource = new EventSource(`/api/exports/${jobId}/stream`);

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
  }, [enabled, jobId]);

  return state;
}
