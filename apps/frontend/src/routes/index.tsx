import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '../pages/Dashboard';
import { queryClient } from '../lib/queryClient';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { bestSpotQueryOptions } from '../hooks/weather/useBestSpotAPI';
import { requireAuth } from '../lib/authGuard';

export const Route = createFileRoute('/')({
  beforeLoad: requireAuth,
  component: Dashboard,
  loader: async () => {
    void queryClient.prefetchQuery(bestSpotQueryOptions(0));
    await queryClient.ensureQueryData(sitesQueryOptions());
  },
});
