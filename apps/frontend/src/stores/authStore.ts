import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      hasHydrated: false,
      login: (token) => set({ token, isAuthenticated: true }),
      logout: () => set({ token: null, isAuthenticated: false }),
    }),
    {
      name: 'parapente-auth',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (_state, error) => {
        useAuthStore.setState({
          isAuthenticated: !!useAuthStore.getState().token && !error,
          hasHydrated: true,
        });
      },
    }
  )
);
