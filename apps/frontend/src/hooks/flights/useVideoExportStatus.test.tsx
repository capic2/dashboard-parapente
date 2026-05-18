import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatEta, toStatusPayload } from './useVideoExportStatus';
import { useVideoExportStatus } from './useVideoExportStatus';

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
  useVideoExportStatus(jobId, true, jobToken);
  return null;
}

beforeEach(() => {
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
      progress: 62,
      eta_seconds: 540,
      message: 'Encoding 32%',
      can_resume: true,
      frames_captured: 120,
      resume_from_frame: 120,
      phase: 'encoding',
    });

    expect(payload).toEqual({
      job_id: 'job-123',
      status: 'processing',
      internal_status: 'encoding',
      progress: 62,
      eta_seconds: 540,
      message: 'Encoding 32%',
      can_resume: true,
      frames_captured: 120,
      resume_from_frame: 120,
      phase: 'encoding',
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
  it('uses the public stream without an auth token when no job token is available', async () => {
    render(<TestHarness jobId="job-123" />);

    await waitFor(() => {
      expect(eventSourceMock.instances).toHaveLength(1);
    });

    expect(eventSourceMock.instances[0]?.url).toContain(
      '/api/exports/job-123/stream'
    );
    expect(eventSourceMock.instances[0]?.url).not.toContain('access_token=');
  });

  it('uses the scoped job-access stream when a job token is available', async () => {
    render(<TestHarness jobId="job-123" jobToken="job-token-abc" />);

    await waitFor(() => {
      expect(eventSourceMock.instances).toHaveLength(1);
    });

    expect(eventSourceMock.instances[0]?.url).toContain(
      '/api/job-access/exports/job-123/stream'
    );
    expect(eventSourceMock.instances[0]?.url).toContain(
      'access_token=job-token-abc'
    );
  });
});
