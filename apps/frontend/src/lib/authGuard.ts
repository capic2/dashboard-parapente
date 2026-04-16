import { redirect } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';

export function requireAuth() {
  const { isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated) {
    throw redirect({ to: '/login' });
  }
}
