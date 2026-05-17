import { createFileRoute, redirect } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { cacheOverviewQueryOptions } from '../hooks/admin/useCache';
import { videoExportJobsQueryOptions } from '../hooks/flights/useVideoExportJobs';
import { requireAuth } from '../lib/authGuard';
import {
  normalizeInfrastructureTab,
  validateInfrastructureSearch,
} from './infrastructure';

export const Route = createFileRoute('/infrastructure/$tab')({
  validateSearch: validateInfrastructureSearch,
  beforeLoad: ({ params, search }) => {
    requireAuth();
    const tab = normalizeInfrastructureTab(params.tab);
    if (tab !== params.tab) {
      throw redirect({
        to: '/infrastructure/$tab',
        params: { tab },
        search,
      });
    }
  },
  loader: () => {
    void queryClient.prefetchQuery(cacheOverviewQueryOptions());
    void queryClient.prefetchQuery(videoExportJobsQueryOptions());
  },
});
