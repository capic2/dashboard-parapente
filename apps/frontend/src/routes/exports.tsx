import { createFileRoute } from '@tanstack/react-router';
import { queryClient } from '../lib/queryClient';
import { videoExportJobsQueryOptions } from '../hooks/flights/useVideoExportJobs';
import { requireAuth } from '../lib/authGuard';

export const Route = createFileRoute('/exports')({
  beforeLoad: requireAuth,
  loader: () => queryClient.ensureQueryData(videoExportJobsQueryOptions()),
});
