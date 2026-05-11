import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { flightsQueryOptions } from '../hooks/flights/useFlights';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { requireAuth } from '../lib/authGuard';

type FlightsSearch = {
  flightId?: string;
  siteId?: string;
};

export const Route = createFileRoute('/flights')({
  validateSearch: (search: Record<string, unknown>): FlightsSearch => ({
    flightId: typeof search.flightId === 'string' ? search.flightId : undefined,
    siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
  }),
  beforeLoad: requireAuth,
  loaderDeps: ({ search }) => ({ siteId: search.siteId }),
  loader: async ({ deps }) => {
    await Promise.all([
      queryClient.ensureQueryData(
        flightsQueryOptions({ limit: 50, siteId: deps.siteId })
      ),
      queryClient.ensureQueryData(sitesQueryOptions()),
    ]);
  },
});
