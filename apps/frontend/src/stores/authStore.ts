import { create } from 'zustand';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

function loadToken(): string | null {
  try {
    const raw = localStorage.getItem('parapente-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

const initialToken = loadToken();

export const useAuthStore = create<AuthState>()((set) => ({
  token: initialToken,
  isAuthenticated: !!initialToken,
  login: (token) => {
    localStorage.setItem(
      'parapente-auth',
      JSON.stringify({ state: { token } })
    );
    set({ token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('parapente-auth');
    set({ token: null, isAuthenticated: false });
  },
}));
