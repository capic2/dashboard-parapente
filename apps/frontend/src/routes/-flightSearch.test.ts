import { describe, expect, it } from 'vitest';
import {
  normalizeFlightsSearch,
  serializeFlightsSearch,
  validateFlightsSearch,
} from './-flightSearch';

describe('flight list search', () => {
  it('rejects invalid enum values and trims text filters centrally', () => {
    expect(
      normalizeFlightsSearch(
        validateFlightsSearch({
          q: '  ridge  ',
          siteId: ' site-1 ',
          gpx: 'invalid',
          sort: 'invalid',
          order: 'invalid',
        })
      )
    ).toEqual({
      q: 'ridge',
      siteId: 'site-1',
      gpx: 'all',
      sort: 'flight_date',
      order: 'desc',
    });
  });

  it('omits defaults while preserving active URL filters', () => {
    expect(
      serializeFlightsSearch({
        q: 'cross',
        siteId: 'site-1',
        gpx: 'with',
        sort: 'distance_km',
        order: 'asc',
      })
    ).toEqual({
      q: 'cross',
      siteId: 'site-1',
      gpx: 'with',
      sort: 'distance_km',
      order: 'asc',
    });
  });

  it('enforces the API search length limit', () => {
    expect(() => validateFlightsSearch({ q: 'x'.repeat(201) })).toThrow();
    expect(validateFlightsSearch({ q: 'x'.repeat(200) }).q).toHaveLength(200);
  });
});
