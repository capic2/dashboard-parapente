import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { requireAuth } from '../lib/authGuard';
import { goproOverlayLayoutsQueryOptions } from '../hooks/gopro/useGoproOverlay';

export const Route = createFileRoute('/gopro-overlay')({
  beforeLoad: requireAuth,
  loader: () => {
    void queryClient.prefetchQuery(goproOverlayLayoutsQueryOptions());
  },
});
