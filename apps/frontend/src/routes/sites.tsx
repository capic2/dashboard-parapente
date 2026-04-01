import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { sitesQueryOptions } from '../hooks/sites/useSites';

export const Route = createFileRoute('/sites')({
  loader: () => queryClient.ensureQueryData(sitesQueryOptions()),
});
