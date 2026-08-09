import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGoproOverlayJobStream } from './useGoproOverlay';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('../../lib/api', () => ({
  api: { get: apiGet },
}));

const eventSourceMock = vi.hoisted(() => {
  const instances: { url: string }[] = [];

  class MockEventSource {
    url: string;
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    close = vi.fn();
    onerror: (() => void) | null = null;

    constructor(url: string) {
      this.url = url;
      instances.push(this);
    }
  }

  return { MockEventSource, instances };
});

function TestHarness({ jobToken }: { jobToken?: string | null }) {
  const { job } = useGoproOverlayJobStream('overlay-job', jobToken, true);
  return <div>{job?.log_tail?.join('\n')}</div>;
}

function renderHarness(jobToken?: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TestHarness jobToken={jobToken} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockReturnValue({
    json: vi.fn().mockResolvedValue({
      job_id: 'overlay-job',
      status: 'completed',
      progress: 100,
      message: 'Overlay ready',
      layout_id: 'parapente-1080',
      layout_label: 'Parapente',
      output_filename: 'final.mp4',
      created_at: '2026-07-31T10:00:00Z',
      updated_at: '2026-07-31T10:10:00Z',
      log_tail: ['Persisted overlay log'],
    }),
  });
  eventSourceMock.instances.length = 0;
  globalThis.EventSource =
    eventSourceMock.MockEventSource as unknown as typeof EventSource;
});

describe('useGoproOverlayJobStream', () => {
  it('polls the authenticated status endpoint when no job token is available', async () => {
    renderHarness();

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        'gopro-overlays/jobs/overlay-job/status'
      );
    });

    expect(eventSourceMock.instances).toHaveLength(0);
    expect(
      await screen.findByText('Persisted overlay log')
    ).toBeInTheDocument();
  });

  it('uses the scoped job-access stream when a job token is available', async () => {
    renderHarness('overlay-token');

    await waitFor(() => {
      expect(eventSourceMock.instances).toHaveLength(1);
    });

    expect(eventSourceMock.instances[0]?.url).toContain(
      '/api/job-access/gopro-overlays/jobs/overlay-job/stream'
    );
    expect(eventSourceMock.instances[0]?.url).toContain(
      'access_token=overlay-token'
    );
    expect(apiGet).not.toHaveBeenCalled();
  });
});
