import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../lib/authGuard';

export const Route = createFileRoute('/viewer/$flightId')({
  beforeLoad: requireAuth,
});
