import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useEffect, useState } from 'react';

export type GoproOverlayLayout = {
  id: string;
  label: string;
  filename: string;
  width: number | null;
  height: number | null;
  exists: boolean;
  recommended: boolean;
};

export type GoproOverlayJob = {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
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
};

type LayoutsResponse = {
  layouts: GoproOverlayLayout[];
};

export const goproOverlayLayoutsQueryOptions = (
  width?: number | null,
  height?: number | null
) =>
  queryOptions<GoproOverlayLayout[]>({
    queryKey: ['gopro-overlays', 'layouts', width ?? null, height ?? null],
    queryFn: async () => {
      const searchParams: Record<string, string> = {};
      if (width != null && height != null) {
        searchParams.width = String(width);
        searchParams.height = String(height);
      }
      const data = await api
        .get('gopro-overlays/layouts', { searchParams })
        .json<LayoutsResponse>();
      return data.layouts;
    },
  });

export function useGoproOverlayLayouts(
  width?: number | null,
  height?: number | null
) {
  return useQuery(goproOverlayLayoutsQueryOptions(width, height));
}

export function useCreateGoproOverlayJob() {
  return useMutation({
    mutationFn: async (formData: FormData) => {
      return await api
        .post('gopro-overlays/jobs', { body: formData, timeout: false })
        .json<GoproOverlayJob>();
    },
  });
}

export function useCancelGoproOverlayJob() {
  return useMutation({
    mutationFn: async (jobId: string) => {
      await api.delete(`gopro-overlays/jobs/${jobId}/cancel`).json();
    },
  });
}

const initialState = {
  job: null as GoproOverlayJob | null,
  isConnected: false,
};

export function useGoproOverlayJobStream(jobId?: string | null) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(initialState);
    if (!jobId || typeof window === 'undefined') {
      return;
    }

    const url = new URL(
      `/api/gopro-overlays/jobs/${jobId}/stream`,
      window.location.origin
    );
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
  }, [jobId]);

  return state;
}
