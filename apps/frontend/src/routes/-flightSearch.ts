import { z } from 'zod';

export const flightGpxStatusSchema = z.enum(['all', 'with', 'missing']);
export const flightSortBySchema = z.enum([
  'flight_date',
  'site_name',
  'duration_minutes',
  'max_altitude_m',
  'distance_km',
]);
export const flightSortOrderSchema = z.enum(['asc', 'desc']);
export const flightDetailsTabSchema = z.enum(['infos', 'replay', 'logs']);
export type FlightDetailsTab = z.infer<typeof flightDetailsTabSchema>;

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  z.string().optional()
);

const optionalSearchQuery = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  z.string().max(200).optional()
);

export const flightsSearchSchema = z.object({
  q: optionalSearchQuery,
  siteId: optionalTrimmedString,
  gpx: flightGpxStatusSchema.catch('all').default('all'),
  sort: flightSortBySchema.catch('flight_date').default('flight_date'),
  order: flightSortOrderSchema.catch('desc').default('desc'),
});

export type FlightsSearch = z.infer<typeof flightsSearchSchema>;
export type FlightsRouteSearch = Partial<FlightsSearch> & {
  tab?: FlightDetailsTab;
};

export function validateFlightsSearch(
  search: Record<string, unknown>
): FlightsRouteSearch {
  const parsedSearch = flightsSearchSchema.parse(search);
  const tab = flightDetailsTabSchema.catch('infos').parse(search.tab);
  return {
    ...serializeFlightsSearch(parsedSearch),
    tab: tab === 'infos' ? undefined : tab,
  };
}

export function normalizeFlightsSearch(
  search: FlightsRouteSearch
): FlightsSearch {
  return flightsSearchSchema.parse(search);
}

export function serializeFlightsSearch(
  search: FlightsSearch
): FlightsRouteSearch {
  return {
    q: search.q || undefined,
    siteId: search.siteId || undefined,
    gpx: search.gpx === 'all' ? undefined : search.gpx,
    sort: search.sort === 'flight_date' ? undefined : search.sort,
    order: search.order === 'desc' ? undefined : search.order,
  };
}
