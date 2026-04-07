import { redirect } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';

export function requireAuth() {
  if (!useAuthStore.getState().isAuthenticated) {
    throw redirect({ to: '/login' });
  }
}
