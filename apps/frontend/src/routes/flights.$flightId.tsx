import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { flightsQueryOptions } from '../hooks/flights/useFlights';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { requireAuth } from '../lib/authGuard';

type FlightsSearch = {
  siteId?: string;
};

export const Route = createFileRoute('/flights/$flightId')({
  validateSearch: (search: Record<string, unknown>): FlightsSearch => ({
    siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
  }),
  beforeLoad: requireAuth,
  loaderDeps: ({ search }) => ({ siteId: search.siteId }),
  loader: ({ deps }) => {
    void queryClient.prefetchQuery(
      flightsQueryOptions({ limit: 50, siteId: deps.siteId })
    );
    void queryClient.prefetchQuery(sitesQueryOptions());
  },
});
