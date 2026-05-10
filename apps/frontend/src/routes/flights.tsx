import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { flightsQueryOptions } from '../hooks/flights/useFlights';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { requireAuth } from '../lib/authGuard';

type FlightsSearch = {
  siteId?: string;
};

export const Route = createFileRoute('/flights')({
  validateSearch: (search: Record<string, unknown>): FlightsSearch => ({
    siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
  }),
  beforeLoad: requireAuth,
  loader: async ({ search }) => {
    await Promise.all([
      queryClient.ensureQueryData(
        flightsQueryOptions({ limit: 50, siteId: search.siteId })
      ),
      queryClient.ensureQueryData(sitesQueryOptions()),
    ]);
  },
});
