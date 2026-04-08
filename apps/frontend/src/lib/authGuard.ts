import { redirect } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';

export function requireAuth() {
  const { hasHydrated, isAuthenticated } = useAuthStore.getState();
  if (hasHydrated && !isAuthenticated) {
    throw redirect({ to: '/login' });
  }
}
