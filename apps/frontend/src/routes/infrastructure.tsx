import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { cacheOverviewQueryOptions } from '../hooks/admin/useCache';
import { videoExportJobsQueryOptions } from '../hooks/flights/useVideoExportJobs';
import { requireAuth } from '../lib/authGuard';

export const Route = createFileRoute('/infrastructure')({
  beforeLoad: requireAuth,
  loader: () => {
    void queryClient.prefetchQuery(cacheOverviewQueryOptions());
    void queryClient.prefetchQuery(videoExportJobsQueryOptions());
  },
});
