import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { cacheOverviewQueryOptions } from '../hooks/admin/useCache';

export const Route = createFileRoute('/cache')({
  loader: async () => {
    await queryClient.ensureQueryData(cacheOverviewQueryOptions());
  },
});
