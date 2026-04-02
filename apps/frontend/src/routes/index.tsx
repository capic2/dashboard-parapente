import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '../pages/Dashboard';
import { queryClient } from '../lib/queryClient';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { bestSpotQueryOptions } from '../hooks/weather/useBestSpotAPI';

export const Route = createFileRoute('/')({
  component: Dashboard,
  loader: async () => {
    void queryClient.prefetchQuery(bestSpotQueryOptions(0));
    await queryClient.ensureQueryData(sitesQueryOptions());
  },
});
