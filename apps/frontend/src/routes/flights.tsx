import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { flightsQueryOptions } from '../hooks/flights/useFlights';
import { sitesQueryOptions } from '../hooks/sites/useSites';

export const Route = createFileRoute('/flights')({
  loader: async () => {
    await Promise.all([
      queryClient.ensureQueryData(flightsQueryOptions({ limit: 50 })),
      queryClient.ensureQueryData(sitesQueryOptions()),
    ]);
  },
});
