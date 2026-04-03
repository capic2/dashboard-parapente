import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FreshnessLevel = 'realtime' | 'normal' | 'economy';
export type HttpTimeout = 15000 | 30000 | 60000;

interface CacheSettingsStore {
  freshnessLevel: FreshnessLevel;
  autoRefreshWeather: boolean;
  httpTimeout: HttpTimeout;
  setFreshnessLevel: (level: FreshnessLevel) => void;
  setAutoRefreshWeather: (enabled: boolean) => void;
  setHttpTimeout: (timeout: HttpTimeout) => void;
}

export const useCacheSettingsStore = create<CacheSettingsStore>()(
  persist(
    (set) => ({
      freshnessLevel: 'normal',
      autoRefreshWeather: true,
      httpTimeout: 30000,

      setFreshnessLevel: (level) => set({ freshnessLevel: level }),
      setAutoRefreshWeather: (enabled) => set({ autoRefreshWeather: enabled }),
      setHttpTimeout: (timeout) => set({ httpTimeout: timeout }),
    }),
    {
      name: 'parapente-cache-settings',
      partialize: (state) => ({
        freshnessLevel: state.freshnessLevel,
        autoRefreshWeather: state.autoRefreshWeather,
        httpTimeout: state.httpTimeout,
      }),
    }
  )
);
