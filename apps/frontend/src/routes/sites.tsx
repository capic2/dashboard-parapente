import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { requireAuth } from '../lib/authGuard';

export const Route = createFileRoute('/sites')({
  beforeLoad: requireAuth,
  loader: () => queryClient.ensureQueryData(sitesQueryOptions()),
});
