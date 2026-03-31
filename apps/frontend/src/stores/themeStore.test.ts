import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore, initTheme } from './themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    // Reset store state
    useThemeStore.setState({ preference: 'light', resolved: 'light' });
    // Clear localStorage
    localStorage.clear();
    // Reset dark class
    document.documentElement.classList.remove('dark');
  });

  describe('setPreference', () => {
    it('applies dark class when preference is set to dark', () => {
      useThemeStore.getState().setPreference('dark');

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(useThemeStore.getState().preference).toBe('dark');
      expect(useThemeStore.getState().resolved).toBe('dark');
    });

    it('removes dark class when preference is set to light', () => {
      document.documentElement.classList.add('dark');

      useThemeStore.getState().setPreference('light');

      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(useThemeStore.getState().preference).toBe('light');
      expect(useThemeStore.getState().resolved).toBe('light');
    });

    it('resolves auto preference using system preference', () => {
      // matchMedia is mocked to return matches: false (light) by default in setup.ts
      useThemeStore.getState().setPreference('auto');

      expect(useThemeStore.getState().preference).toBe('auto');
      expect(useThemeStore.getState().resolved).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('resolves auto to dark when system prefers dark', () => {
      vi.mocked(window.matchMedia).mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      useThemeStore.getState().setPreference('auto');

      expect(useThemeStore.getState().resolved).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('initTheme', () => {
    it('applies dark class when persisted preference is dark', () => {
      localStorage.setItem(
        'parapente-theme',
        JSON.stringify({ state: { preference: 'dark' }, version: 0 })
      );
      useThemeStore.setState({ preference: 'dark', resolved: 'light' });

      initTheme();

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(useThemeStore.getState().resolved).toBe('dark');
    });

    it('does not apply dark class when persisted preference is light', () => {
      localStorage.setItem(
        'parapente-theme',
        JSON.stringify({ state: { preference: 'light' }, version: 0 })
      );
      useThemeStore.setState({ preference: 'light', resolved: 'light' });

      initTheme();

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('migrates theme from paragliding-settings when parapente-theme is absent', () => {
      localStorage.setItem(
        'paragliding-settings',
        JSON.stringify({ theme: 'dark' })
      );

      initTheme();

      const stored = localStorage.getItem('parapente-theme');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}') as { state: { preference: string } };
      expect(parsed.state.preference).toBe('dark');
    });

    it('does not overwrite existing parapente-theme with migration', () => {
      localStorage.setItem(
        'parapente-theme',
        JSON.stringify({ state: { preference: 'light' }, version: 0 })
      );
      localStorage.setItem(
        'paragliding-settings',
        JSON.stringify({ theme: 'dark' })
      );

      // parapente-theme already exists, so migration should not run
      initTheme();

      const stored = JSON.parse(
        localStorage.getItem('parapente-theme') ?? '{}'
      ) as { state: { preference: string } };
      expect(stored.state.preference).toBe('light');
    });
  });

  describe('persistence', () => {
    it('persists preference to localStorage', () => {
      useThemeStore.getState().setPreference('dark');

      // Zustand persist is async, but setState triggers synchronously in tests
      const stored = localStorage.getItem('parapente-theme');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}') as { state: { preference: string } };
      expect(parsed.state.preference).toBe('dark');
    });
  });
});
