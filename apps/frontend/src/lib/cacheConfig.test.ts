import { describe, it, expect, beforeEach } from 'vitest';
import { useCacheSettingsStore } from '../stores/cacheSettingsStore';
import { getStaleTime, getWeatherRefetchInterval } from './cacheConfig';

describe('cacheConfig', () => {
  beforeEach(() => {
    useCacheSettingsStore.setState({
      freshnessLevel: 'normal',
      autoRefreshWeather: true,
      httpTimeout: 30000,
    });
  });

  describe('getStaleTime', () => {
    it('returns base value when freshness is normal (1x)', () => {
      expect(getStaleTime(300000)).toBe(300000); // 5 min
    });

    it('returns half value when freshness is realtime (0.5x)', () => {
      useCacheSettingsStore.setState({ freshnessLevel: 'realtime' });
      expect(getStaleTime(300000)).toBe(150000); // 2.5 min
    });

    it('returns triple value when freshness is economy (3x)', () => {
      useCacheSettingsStore.setState({ freshnessLevel: 'economy' });
      expect(getStaleTime(300000)).toBe(900000); // 15 min
    });

    it('rounds to nearest integer', () => {
      useCacheSettingsStore.setState({ freshnessLevel: 'realtime' });
      expect(getStaleTime(1000 * 60 * 5)).toBe(150000); // 2.5 min exact
      expect(getStaleTime(33333)).toBe(16667); // rounded
    });
  });

  describe('getWeatherRefetchInterval', () => {
    it('returns interval when auto-refresh is enabled', () => {
      expect(getWeatherRefetchInterval(600000)).toBe(600000); // 10 min
    });

    it('returns false when auto-refresh is disabled', () => {
      useCacheSettingsStore.setState({ autoRefreshWeather: false });
      expect(getWeatherRefetchInterval(600000)).toBe(false);
    });

    it('applies freshness multiplier to interval', () => {
      useCacheSettingsStore.setState({ freshnessLevel: 'economy' });
      expect(getWeatherRefetchInterval(600000)).toBe(1800000); // 30 min
    });

    it('returns false even with economy when auto-refresh disabled', () => {
      useCacheSettingsStore.setState({
        freshnessLevel: 'economy',
        autoRefreshWeather: false,
      });
      expect(getWeatherRefetchInterval(600000)).toBe(false);
    });
  });
});
