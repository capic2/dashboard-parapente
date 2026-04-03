import { useCacheSettingsStore } from '../stores/cacheSettingsStore';
import type { FreshnessLevel } from '../stores/cacheSettingsStore';

const FRESHNESS_MULTIPLIERS: Record<FreshnessLevel, number> = {
  realtime: 0.5,
  normal: 1,
  economy: 3,
};

/**
 * Apply the user's freshness multiplier to a base staleTime value.
 * Reads from the Zustand store synchronously (getState).
 */
export function getStaleTime(baseMs: number): number {
  const level = useCacheSettingsStore.getState().freshnessLevel;
  return Math.round(baseMs * FRESHNESS_MULTIPLIERS[level]);
}

/**
 * Returns the refetchInterval for weather hooks,
 * or false if auto-refresh is disabled.
 */
export function getWeatherRefetchInterval(baseMs: number): number | false {
  const { autoRefreshWeather, freshnessLevel } =
    useCacheSettingsStore.getState();
  if (!autoRefreshWeather) return false;
  return Math.round(baseMs * FRESHNESS_MULTIPLIERS[freshnessLevel]);
}
