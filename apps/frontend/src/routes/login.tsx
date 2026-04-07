import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';
import Login from '../pages/Login';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: '/' });
    }
  },
  component: Login,
});
