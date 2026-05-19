import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { cacheOverviewQueryOptions } from '../hooks/admin/useCache';
import { videoExportJobsQueryOptions } from '../hooks/flights/useVideoExportJobs';
import { requireAuth } from '../lib/authGuard';

const infrastructureTabs = ['strava', 'video-exports', 'cache'] as const;

export type InfrastructureTab = (typeof infrastructureTabs)[number];

export type InfrastructureSearch = {
  cacheSearch?: string;
  cacheAutoRefresh?: boolean;
};

export function normalizeInfrastructureTab(tab: unknown): InfrastructureTab {
  return infrastructureTabs.includes(tab as InfrastructureTab)
    ? (tab as InfrastructureTab)
    : 'strava';
}

export function validateInfrastructureSearch(
  search: Record<string, unknown>
): InfrastructureSearch {
  return {
    cacheSearch:
      typeof search.cacheSearch === 'string' && search.cacheSearch.length > 0
        ? search.cacheSearch
        : undefined,
    cacheAutoRefresh:
      search.cacheAutoRefresh === true || search.cacheAutoRefresh === 'true'
        ? true
        : undefined,
  };
}

export const Route = createFileRoute('/infrastructure')({
  validateSearch: validateInfrastructureSearch,
  beforeLoad: requireAuth,
  loader: () => {
    void queryClient.prefetchQuery(cacheOverviewQueryOptions());
    void queryClient.prefetchQuery(videoExportJobsQueryOptions());
  },
});
