import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import {
  flightStatsQueryOptions,
  flightRecordsQueryOptions,
} from '../hooks/flights/useFlights';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { requireAuth } from '../lib/authGuard';

type AnalyticsSearch = {
  siteId?: string;
  dateFrom?: string;
  dateTo?: string;
};

const isISODate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value);

export const Route = createFileRoute('/analytics')({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>): AnalyticsSearch => {
    return {
      siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
      dateFrom: isISODate(search.dateFrom) ? search.dateFrom : undefined,
      dateTo: isISODate(search.dateTo) ? search.dateTo : undefined,
    };
  },
  loader: () => {
    void queryClient.prefetchQuery(flightStatsQueryOptions());
    void queryClient.prefetchQuery(flightRecordsQueryOptions());
    void queryClient.prefetchQuery(sitesQueryOptions());
  },
});
