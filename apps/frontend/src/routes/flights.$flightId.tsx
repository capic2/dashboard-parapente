import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { flightQueryOptions } from '../hooks/flights/useFlight';
import { flightSummariesQueryOptions } from '../hooks/flights/useFlightSummaries';
import { requireAuth } from '../lib/authGuard';
import { normalizeFlightsSearch, validateFlightsSearch } from './-flightSearch';

export const Route = createFileRoute('/flights/$flightId')({
  validateSearch: validateFlightsSearch,
  beforeLoad: requireAuth,
  loaderDeps: ({ search }) => normalizeFlightsSearch(search),
  loader: ({ deps, params }) => {
    void queryClient.prefetchInfiniteQuery(flightSummariesQueryOptions(deps));
    void queryClient.prefetchQuery(flightQueryOptions(params.flightId));
  },
});
