import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { sitesQueryOptions } from '../hooks/sites/useSites';

type WeatherSearch = {
  siteId?: string;
};

export const Route = createFileRoute('/weather')({
  validateSearch: (search: Record<string, unknown>): WeatherSearch => ({
    siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
  }),
  loader: async () => {
    await queryClient.ensureQueryData(sitesQueryOptions());
  },
});
