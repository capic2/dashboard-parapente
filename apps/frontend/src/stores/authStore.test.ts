import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, isAuthenticated: false });
  });

  describe('login', () => {
    it('sets token and isAuthenticated', () => {
      useAuthStore.getState().login('my-jwt-token');

      expect(useAuthStore.getState().token).toBe('my-jwt-token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('persists token to localStorage', () => {
      useAuthStore.getState().login('my-jwt-token');

      const stored = JSON.parse(
        localStorage.getItem('parapente-auth') ?? '{}'
      ) as { state: { token: string } };
      expect(stored.state.token).toBe('my-jwt-token');
    });
  });

  describe('logout', () => {
    it('clears token and isAuthenticated', () => {
      useAuthStore.getState().login('my-jwt-token');
      useAuthStore.getState().logout();

      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('removes token from localStorage', () => {
      useAuthStore.getState().login('my-jwt-token');
      useAuthStore.getState().logout();

      expect(localStorage.getItem('parapente-auth')).toBeNull();
    });
  });
});
