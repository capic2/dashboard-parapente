import { describe, it, expect, beforeEach } from 'vitest';
import { useCacheSettingsStore } from './cacheSettingsStore';

describe('cacheSettingsStore', () => {
  beforeEach(() => {
    // Reset store state to defaults
    useCacheSettingsStore.setState({
      freshnessLevel: 'normal',
      autoRefreshWeather: true,
      httpTimeout: 30000,
    });
    localStorage.clear();
  });

  describe('setFreshnessLevel', () => {
    it('sets freshness to realtime', () => {
      useCacheSettingsStore.getState().setFreshnessLevel('realtime');
      expect(useCacheSettingsStore.getState().freshnessLevel).toBe('realtime');
    });

    it('sets freshness to economy', () => {
      useCacheSettingsStore.getState().setFreshnessLevel('economy');
      expect(useCacheSettingsStore.getState().freshnessLevel).toBe('economy');
    });
  });

  describe('setAutoRefreshWeather', () => {
    it('disables auto refresh', () => {
      useCacheSettingsStore.getState().setAutoRefreshWeather(false);
      expect(useCacheSettingsStore.getState().autoRefreshWeather).toBe(false);
    });

    it('enables auto refresh', () => {
      useCacheSettingsStore.getState().setAutoRefreshWeather(false);
      useCacheSettingsStore.getState().setAutoRefreshWeather(true);
      expect(useCacheSettingsStore.getState().autoRefreshWeather).toBe(true);
    });
  });

  describe('setHttpTimeout', () => {
    it('sets timeout to 15s', () => {
      useCacheSettingsStore.getState().setHttpTimeout(15000);
      expect(useCacheSettingsStore.getState().httpTimeout).toBe(15000);
    });

    it('sets timeout to 60s', () => {
      useCacheSettingsStore.getState().setHttpTimeout(60000);
      expect(useCacheSettingsStore.getState().httpTimeout).toBe(60000);
    });
  });

  describe('persistence', () => {
    it('persists freshnessLevel to localStorage', () => {
      useCacheSettingsStore.getState().setFreshnessLevel('economy');

      const stored = localStorage.getItem('parapente-cache-settings');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}') as {
        state: { freshnessLevel: string };
      };
      expect(parsed.state.freshnessLevel).toBe('economy');
    });

    it('persists autoRefreshWeather to localStorage', () => {
      useCacheSettingsStore.getState().setAutoRefreshWeather(false);

      const stored = localStorage.getItem('parapente-cache-settings');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}') as {
        state: { autoRefreshWeather: boolean };
      };
      expect(parsed.state.autoRefreshWeather).toBe(false);
    });

    it('persists httpTimeout to localStorage', () => {
      useCacheSettingsStore.getState().setHttpTimeout(60000);

      const stored = localStorage.getItem('parapente-cache-settings');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}') as {
        state: { httpTimeout: number };
      };
      expect(parsed.state.httpTimeout).toBe(60000);
    });
  });
});
