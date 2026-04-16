import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { cacheOverviewQueryOptions } from '../hooks/admin/useCache';
import { requireAuth } from '../lib/authGuard';

export const Route = createFileRoute('/infrastructure')({
  beforeLoad: requireAuth,
  loader: async () => {
    await queryClient.ensureQueryData(cacheOverviewQueryOptions());
  },
});
