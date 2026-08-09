import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatEta, toStatusPayload } from './useVideoExportStatus';
import { useVideoExportStatus } from './useVideoExportStatus';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('../../lib/api', () => ({
  api: { get: apiGet },
}));

const eventSourceMock = vi.hoisted(() => {
  const instances: {
    url: string;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }[] = [];

  class MockEventSource {
    url: string;
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    close = vi.fn();

    constructor(url: string) {
      this.url = url;
      instances.push(this);
    }
  }

  return { MockEventSource, instances };
});

function TestHarness({
  jobId,
  jobToken,
}: {
  jobId?: string | null;
  jobToken?: string | null;
}) {
  const { status } = useVideoExportStatus(jobId, true, jobToken);
  return <div>{status?.log_tail?.join('\n')}</div>;
}

function renderHarness(props: {
  jobId?: string | null;
  jobToken?: string | null;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TestHarness {...props} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockReturnValue({
    json: vi.fn().mockResolvedValue({
      job_id: 'job-123',
      status: 'completed',
      internal_status: 'completed',
      render_method: 'gpu',
      log_tail: ['Persisted export log'],
    }),
  });
  eventSourceMock.instances.length = 0;
  globalThis.EventSource =
    eventSourceMock.MockEventSource as unknown as typeof EventSource;
});

describe('toStatusPayload', () => {
  it('parses valid export payload', () => {
    const payload = toStatusPayload({
      job_id: 'job-123',
      status: 'processing',
      internal_status: 'encoding',
      render_method: 'gpu',
      progress: 62,
      eta_seconds: 540,
      message: 'Encoding 32%',
      error: null,
      can_resume: true,
      frames_captured: 120,
      resume_from_frame: 120,
      phase: 'encoding',
      log_tail: ['Opening viewer', 'Encoding 32%', 42],
    });

    expect(payload).toEqual({
      job_id: 'job-123',
      status: 'processing',
      internal_status: 'encoding',
      render_method: 'gpu',
      progress: 62,
      eta_seconds: 540,
      message: 'Encoding 32%',
      error: null,
      can_resume: true,
      frames_captured: 120,
      resume_from_frame: 120,
      phase: 'encoding',
      log_tail: ['Opening viewer', 'Encoding 32%'],
    });
  });

  it('returns null for invalid payloads', () => {
    expect(toStatusPayload(null)).toBeNull();
    expect(toStatusPayload({})).toBeNull();
    expect(
      toStatusPayload({
        job_id: 'job-123',
      })
    ).toBeNull();
  });
});

describe('formatEta', () => {
  it('formats ETA in minutes and hours', () => {
    expect(formatEta(-1)).toBeNull();
    expect(formatEta(30)).toBe('< 1 min');
    expect(formatEta(300)).toBe('5 min');
    expect(formatEta(3599)).toBe('1 h 00 min');
    expect(formatEta(3900)).toBe('1 h 05 min');
    expect(formatEta(7199)).toBe('2 h 00 min');
  });
});

describe('useVideoExportStatus', () => {
  it('polls the authenticated status endpoint when no job token is available', async () => {
    renderHarness({ jobId: 'job-123' });

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('exports/job-123/status');
    });

    expect(eventSourceMock.instances).toHaveLength(0);
    expect(await screen.findByText('Persisted export log')).toBeInTheDocument();
  });

  it('uses the scoped job-access stream when a job token is available', async () => {
    renderHarness({ jobId: 'job-123', jobToken: 'job-token-abc' });

    await waitFor(() => {
      expect(eventSourceMock.instances).toHaveLength(1);
    });

    expect(eventSourceMock.instances[0]?.url).toContain(
      '/api/job-access/exports/job-123/stream'
    );
    expect(eventSourceMock.instances[0]?.url).toContain(
      'access_token=job-token-abc'
    );
    expect(apiGet).not.toHaveBeenCalled();
  });
});
