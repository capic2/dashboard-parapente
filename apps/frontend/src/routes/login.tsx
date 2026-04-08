import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';
import Login from '../pages/Login';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const { hasHydrated, isAuthenticated } = useAuthStore.getState();
    if (hasHydrated && isAuthenticated) {
      throw redirect({ to: '/' });
    }
  },
  component: Login,
});
