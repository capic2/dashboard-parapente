import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../stores/authStore';

vi.mock('@tanstack/react-router', () => ({
  redirect: (opts: { to: string }) => opts,
}));

// Import after mock so requireAuth uses the mocked redirect
const { requireAuth } = await import('./authGuard');

describe('requireAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, isAuthenticated: false });
  });

  it('throws redirect to /login when not authenticated', () => {
    try {
      requireAuth();
      throw new Error('expected requireAuth to throw');
    } catch (error) {
      expect(error).toMatchObject({ to: '/login' });
    }
  });

  it('does not throw when authenticated', () => {
    useAuthStore.setState({ token: 'valid-token', isAuthenticated: true });

    expect(() => requireAuth()).not.toThrow();
  });
});
