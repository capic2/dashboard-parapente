import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import {
  flightStatsQueryOptions,
  flightRecordsQueryOptions,
  flightsQueryOptions,
} from '../hooks/flights/useFlights';
import { sitesQueryOptions } from '../hooks/sites/useSites';

export const Route = createFileRoute('/analytics')({
  loader: async () => {
    await Promise.all([
      queryClient.ensureQueryData(flightStatsQueryOptions()),
      queryClient.ensureQueryData(flightRecordsQueryOptions()),
      queryClient.ensureQueryData(flightsQueryOptions()),
      queryClient.ensureQueryData(sitesQueryOptions()),
    ]);
  },
});
