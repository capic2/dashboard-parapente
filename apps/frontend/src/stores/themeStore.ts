import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeStore {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'auto' ? getSystemTheme() : preference;
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      preference: 'light',
      resolved: 'light',

      setPreference: (pref) => {
        const resolved = resolveTheme(pref);
        applyTheme(resolved);
        set({ preference: pref, resolved });
      },
    }),
    {
      name: 'parapente-theme',
      partialize: (state) => ({ preference: state.preference }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.preference);
          state.resolved = resolved;
          applyTheme(resolved);
        }
      },
    }
  )
);

let mediaQueryCleanup: (() => void) | null = null;

export function initTheme() {
  // Migrate from old settings if theme store has no persisted data
  const storedTheme = localStorage.getItem('parapente-theme');
  if (!storedTheme) {
    try {
      const oldSettings = localStorage.getItem('paragliding-settings');
      if (oldSettings) {
        const parsed = JSON.parse(oldSettings) as { theme?: ThemePreference };
        if (parsed.theme && ['light', 'dark', 'auto'].includes(parsed.theme)) {
          localStorage.setItem(
            'parapente-theme',
            JSON.stringify({ state: { preference: parsed.theme }, version: 0 })
          );
        }
      }
    } catch {
      // Ignore migration errors
    }
  }

  // Re-hydrate after potential migration
  if (!storedTheme) {
    useThemeStore.persist.rehydrate();
  }

  const state = useThemeStore.getState();
  const resolved = resolveTheme(state.preference);
  applyTheme(resolved);
  useThemeStore.setState({ resolved });

  // Set up system preference listener for auto mode
  setupMediaQueryListener();

  // Re-setup listener when preference changes
  useThemeStore.subscribe((newState, prevState) => {
    if (newState.preference !== prevState.preference) {
      setupMediaQueryListener();
    }
  });
}

function setupMediaQueryListener() {
  // Clean up previous listener
  if (mediaQueryCleanup) {
    mediaQueryCleanup();
    mediaQueryCleanup = null;
  }

  const { preference } = useThemeStore.getState();
  if (preference !== 'auto') return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    const resolved: ResolvedTheme = e.matches ? 'dark' : 'light';
    applyTheme(resolved);
    useThemeStore.setState({ resolved });
  };

  mediaQuery.addEventListener('change', handler);
  mediaQueryCleanup = () => mediaQuery.removeEventListener('change', handler);
}
