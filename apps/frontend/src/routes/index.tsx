import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '../pages/Dashboard';
import { queryClient } from '../lib/queryClient';
import { sitesQueryOptions } from '../hooks/useSites';
import { bestSpotQueryOptions } from '../hooks/useBestSpotAPI';

export const Route = createFileRoute('/')({
  component: Dashboard,
  loader: () => {
    queryClient.ensureQueryData(sitesQueryOptions());
    queryClient.ensureQueryData(bestSpotQueryOptions(0));
  },
});
