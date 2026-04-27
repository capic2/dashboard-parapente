import { describe, expect, it } from 'vitest';
import { formatEta, toStatusPayload } from './useVideoExportStatus';

describe('toStatusPayload', () => {
  it('parses valid export payload', () => {
    const payload = toStatusPayload({
      job_id: 'job-123',
      status: 'processing',
      internal_status: 'encoding',
      progress: 62,
      eta_seconds: 540,
      message: 'Encoding 32%',
      phase: 'encoding',
    });

    expect(payload).toEqual({
      job_id: 'job-123',
      status: 'processing',
      internal_status: 'encoding',
      progress: 62,
      eta_seconds: 540,
      message: 'Encoding 32%',
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
