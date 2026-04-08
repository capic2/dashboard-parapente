import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import {
  flightStatsQueryOptions,
  flightRecordsQueryOptions,
} from '../hooks/flights/useFlights';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { requireAuth } from '../lib/authGuard';

export const Route = createFileRoute('/analytics')({
  beforeLoad: requireAuth,
  loader: async () => {
    await Promise.all([
      queryClient.ensureQueryData(flightStatsQueryOptions()),
      queryClient.ensureQueryData(flightRecordsQueryOptions()),
      queryClient.ensureQueryData(sitesQueryOptions()),
    ]);
  },
});
