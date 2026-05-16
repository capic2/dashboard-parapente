import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { sitesQueryOptions } from '../hooks/sites/useSites';

type WeatherSearch = {
  siteId?: string;
  day?: number;
};

export const Route = createFileRoute('/weather')({
  validateSearch: (search: Record<string, unknown>): WeatherSearch => {
    const rawDay = search.day;
    const parsedDay =
      typeof rawDay === 'string' || typeof rawDay === 'number'
        ? Number(rawDay)
        : Number.NaN;

    return {
      siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
      day:
        Number.isInteger(parsedDay) && parsedDay >= 0 && parsedDay <= 6
          ? parsedDay
          : undefined,
    };
  },
  loader: () => {
    void queryClient.prefetchQuery(sitesQueryOptions());
  },
});
