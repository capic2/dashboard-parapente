import { describe, expect, it } from 'vitest';
import { FlightSummariesResponseSchema } from '@dashboard-parapente/shared-types';
import {
  activeFlightMediaJobsQueryOptions,
  flightSummariesQueryOptions,
  getFinishedActiveFlightIds,
  getNextFlightSummariesPageParam,
  mergeActiveMediaJobs,
  serializeFlightSummariesQuery,
} from './useFlightSummaries';

const summary = FlightSummariesResponseSchema.parse({
  flights: [
    {
      id: 'flight-1',
      site_id: null,
      site_name: null,
      site_region: null,
      name: null,
      title: null,
      flight_date: '2026-07-01',
      departure_time: null,
      duration_minutes: null,
      max_altitude_m: null,
      distance_km: null,
      elevation_gain_m: null,
      has_gpx: false,
      has_video: false,
      has_gopro_overlay: false,
      video_export_job_id: null,
      video_export_status: null,
      video_export_progress: null,
      gopro_overlay_job_id: null,
      gopro_overlay_status: null,
      gopro_overlay_progress: null,
    },
  ],
  total: 26,
  next_cursor: 'opaque-token',
});

describe('flight summary queries', () => {
  it('polls only the filtered active-job query', () => {
    const search = {
      gpx: 'all',
      sort: 'flight_date',
      order: 'desc',
    } as const;

    expect(flightSummariesQueryOptions(search).refetchInterval).toBeUndefined();
    const interval = activeFlightMediaJobsQueryOptions().refetchInterval;
    expect(interval).toBeTypeOf('function');
    if (typeof interval !== 'function') return;
    expect(interval({ state: { data: undefined } } as never)).toBe(10000);
    expect(interval({ state: { data: [] } } as never)).toBe(false);
    expect(interval({ state: { data: [{}] } } as never)).toBe(10000);
  });

  it('serializes the backend query contract', () => {
    expect(
      serializeFlightSummariesQuery(
        {
          q: 'ridge',
          siteId: 'site-1',
          gpx: 'missing',
          sort: 'duration_minutes',
          order: 'asc',
        },
        'opaque-token'
      )
    ).toEqual({
      page_size: '25',
      cursor: 'opaque-token',
      q: 'ridge',
      site_id: 'site-1',
      gpx_status: 'missing',
      sort_by: 'duration_minutes',
      sort_order: 'asc',
    });
  });

  it('continues pagination only when the API returns a cursor', () => {
    expect(getNextFlightSummariesPageParam(summary)).toBe('opaque-token');
    expect(
      getNextFlightSummariesPageParam({ next_cursor: null })
    ).toBeUndefined();
  });

  it('merges active video and overlay progress without refetching pages', () => {
    const [flight] = mergeActiveMediaJobs(summary.flights, [
      {
        job_id: 'video-job',
        flight_id: 'flight-1',
        status: 'running',
        progress: 42,
        mode: 'manual',
      },
      {
        job_id: 'overlay-job',
        flight_id: 'flight-1',
        status: 'running',
        progress: 24,
        mode: 'gopro_overlay',
      },
    ]);
    expect(flight.video_export_progress).toBe(42);
    expect(flight.gopro_overlay_progress).toBe(24);
  });

  it('identifies flights whose active jobs disappeared', () => {
    expect(
      getFinishedActiveFlightIds(
        [
          {
            job_id: 'finished-job',
            flight_id: 'flight-1',
            status: 'running',
            mode: 'manual',
          },
          {
            job_id: 'active-job',
            flight_id: 'flight-2',
            status: 'running',
            mode: 'gopro_overlay',
          },
        ],
        [
          {
            job_id: 'active-job',
            flight_id: 'flight-2',
            status: 'running',
            mode: 'gopro_overlay',
          },
        ]
      )
    ).toEqual(['flight-1']);
  });
});
