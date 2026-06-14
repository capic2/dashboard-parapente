// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVideoExportJobs } from './useVideoExportJobs';

const { apiGet } = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: apiGet,
  },
}));

const eventSourceMock = vi.hoisted(() => {
  const instances: MockEventSource[] = [];

  class MockEventSource {
    url: string;
    listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();
    close = vi.fn();

    constructor(url: string) {
      this.url = url;
      instances.push(this);
    }

    addEventListener(
      eventName: string,
      listener: (event: MessageEvent<string>) => void
    ) {
      const listeners = this.listeners.get(eventName) ?? [];
      listeners.push(listener);
      this.listeners.set(eventName, listeners);
    }

    removeEventListener(
      eventName: string,
      listener: (event: MessageEvent<string>) => void
    ) {
      const listeners = this.listeners.get(eventName) ?? [];
      this.listeners.set(
        eventName,
        listeners.filter((item) => item !== listener)
      );
    }

    emit(eventName: string, data: unknown) {
      for (const listener of this.listeners.get(eventName) ?? []) {
        listener({ data: JSON.stringify(data) } as MessageEvent<string>);
      }
    }
  }

  return { MockEventSource, instances };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function TestHarness() {
  const { data = [] } = useVideoExportJobs();

  return <div>{data.map((job) => job.job_id).join(',')}</div>;
}

describe('useVideoExportJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventSourceMock.instances.length = 0;
    apiGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({ jobs: [] }),
    });
    globalThis.EventSource =
      eventSourceMock.MockEventSource as unknown as typeof EventSource;
  });

  it('updates cached jobs from the global SSE stream', async () => {
    render(<TestHarness />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(eventSourceMock.instances).toHaveLength(1);
    });

    expect(eventSourceMock.instances[0]?.url).toContain(
      '/api/video-export-jobs/stream'
    );

    eventSourceMock.instances[0]?.emit('jobs', {
      jobs: [
        {
          job_id: 'job-from-stream',
          status: 'processing',
          can_cancel: true,
          can_delete: true,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('job-from-stream')).toBeInTheDocument();
    });
  });
});
