import { createFileRoute, redirect } from '@tanstack/react-router';
import { requireAuth } from '../lib/authGuard';

/** Keep old bookmarks working after the thermal page was renamed to /thermal. */
export const Route = createFileRoute('/thermal-analysis')({
  beforeLoad: () => {
    requireAuth();
    throw redirect({ to: '/thermal' });
  },
});
