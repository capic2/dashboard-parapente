import { describe, expect, it } from 'vitest';
import { parseApiUtcDate } from './date';

describe('parseApiUtcDate', () => {
  it('treats ISO datetime without timezone as UTC', () => {
    expect(parseApiUtcDate('2026-04-15T10:00:00').toISOString()).toBe(
      '2026-04-15T10:00:00.000Z'
    );
  });

  it('preserves ISO datetime with Z suffix', () => {
    expect(parseApiUtcDate('2026-04-15T10:00:00Z').toISOString()).toBe(
      '2026-04-15T10:00:00.000Z'
    );
  });

  it('preserves ISO datetime with numeric offset', () => {
    expect(parseApiUtcDate('2026-04-15T10:00:00+02:00').toISOString()).toBe(
      '2026-04-15T08:00:00.000Z'
    );
  });
});
