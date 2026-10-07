import { describe, expect, it } from 'vitest';
import { getFlightGpxProvider } from './flightGpxProvider';

describe('getFlightGpxProvider', () => {
  it('uses the explicit GPX provider when present', () => {
    expect(
      getFlightGpxProvider({
        gpx_provider: 'zepp',
        external_provider: 'intervals_icu',
      })
    ).toBe('zepp');
  });

  it('leaves legacy Intervals GPX provenance unknown', () => {
    expect(
      getFlightGpxProvider({
        gpx_provider: null,
        external_provider: 'intervals_icu',
      })
    ).toBeNull();
  });

  it('keeps the legacy Strava provider fallback', () => {
    expect(
      getFlightGpxProvider({
        gpx_provider: null,
        external_provider: 'strava',
      })
    ).toBe('strava');
  });
});
