import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import {
  ActiveFlightMediaJobsResponseSchema,
  FlightSummariesResponseSchema,
  type ActiveFlightMediaJob,
  type FlightSummary,
} from '@dashboard-parapente/shared-types';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';
import type { FlightsSearch } from '../../routes/-flightSearch';

export const FLIGHT_SUMMARIES_PAGE_SIZE = 25;

export function serializeFlightSummariesQuery(
  search: FlightsSearch,
  cursor: string | null
) {
  const searchParams: Record<string, string> = {
    page_size: String(FLIGHT_SUMMARIES_PAGE_SIZE),
    gpx_status: search.gpx,
    sort_by: search.sort,
    sort_order: search.order,
  };
  if (cursor) searchParams.cursor = cursor;
  if (search.q) searchParams.q = search.q;
  if (search.siteId) searchParams.site_id = search.siteId;
  return searchParams;
}

export function getNextFlightSummariesPageParam(lastPage: {
  next_cursor: string | null;
}) {
  return lastPage.next_cursor ?? undefined;
}

export const flightSummariesQueryOptions = (search: FlightsSearch) =>
  infiniteQueryOptions({
    queryKey: ['flights', 'summaries', search],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const data = await api
        .get('flights/summaries', {
          searchParams: serializeFlightSummariesQuery(search, pageParam),
        })
        .json();
      return FlightSummariesResponseSchema.parse(data);
    },
    getNextPageParam: getNextFlightSummariesPageParam,
    staleTime: getStaleTime(1000 * 60 * 10),
    refetchOnWindowFocus: 'always',
  });

export const activeFlightMediaJobsQueryOptions = () =>
  queryOptions({
    queryKey: ['video-export-jobs', 'active'],
    queryFn: async () => {
      const data = await api
        .get('video-export-jobs', {
          searchParams: { active_only: 'true' },
        })
        .json();
      return ActiveFlightMediaJobsResponseSchema.parse(data).jobs;
    },
    refetchInterval: (query) =>
      query.state.data === undefined || query.state.data.length > 0
        ? 10000
        : false,
  });

export function mergeActiveMediaJobs(
  flights: FlightSummary[],
  jobs: ReturnType<typeof ActiveFlightMediaJobsResponseSchema.parse>['jobs']
) {
  if (jobs.length === 0) return flights;

  const jobsByFlight = new Map<string, (typeof jobs)[number][]>();
  for (const job of jobs) {
    if (!job.flight_id) continue;
    jobsByFlight.set(job.flight_id, [
      ...(jobsByFlight.get(job.flight_id) ?? []),
      job,
    ]);
  }

  return flights.map((flight) => {
    const flightJobs = jobsByFlight.get(flight.id);
    if (!flightJobs) return flight;
    const videoJob = flightJobs.find((job) => job.mode !== 'gopro_overlay');
    const overlayJob = flightJobs.find((job) => job.mode === 'gopro_overlay');
    return {
      ...flight,
      ...(videoJob && {
        video_export_job_id: videoJob.job_id,
        video_export_status: videoJob.status,
        video_export_progress: videoJob.progress ?? null,
      }),
      ...(overlayJob && {
        gopro_overlay_job_id: overlayJob.job_id,
        gopro_overlay_status: overlayJob.status,
        gopro_overlay_progress: overlayJob.progress ?? null,
      }),
    };
  });
}

export function getFinishedActiveFlightIds(
  previousJobs: ActiveFlightMediaJob[],
  currentJobs: ActiveFlightMediaJob[]
) {
  const currentJobIds = new Set(currentJobs.map((job) => job.job_id));
  return [
    ...new Set(
      previousJobs
        .filter((job) => !currentJobIds.has(job.job_id))
        .map((job) => job.flight_id)
        .filter((flightId): flightId is string => Boolean(flightId))
    ),
  ];
}

export function useFlightSummaries(search: FlightsSearch) {
  return useInfiniteQuery(flightSummariesQueryOptions(search));
}

export function useActiveFlightMediaJobs() {
  return useQuery(activeFlightMediaJobsQueryOptions());
}
