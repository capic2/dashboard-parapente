import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { flightsQueryOptions } from '../hooks/useFlights';
import { sitesQueryOptions } from '../hooks/useSites';

export const Route = createFileRoute('/flights')({
  loader: () => {
    queryClient.ensureQueryData(flightsQueryOptions({ limit: 50 }));
    queryClient.ensureQueryData(sitesQueryOptions());
  },
});
