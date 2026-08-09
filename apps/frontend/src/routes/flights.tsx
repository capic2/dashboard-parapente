import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { flightSummariesQueryOptions } from '../hooks/flights/useFlightSummaries';
import { requireAuth } from '../lib/authGuard';
import { normalizeFlightsSearch, validateFlightsSearch } from './-flightSearch';

export const Route = createFileRoute('/flights')({
  validateSearch: validateFlightsSearch,
  beforeLoad: requireAuth,
  loaderDeps: ({ search }) => normalizeFlightsSearch(search),
  loader: ({ deps }) => {
    void queryClient.prefetchInfiniteQuery(flightSummariesQueryOptions(deps));
  },
});
