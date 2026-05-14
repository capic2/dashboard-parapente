import { beforeEach, describe, expect, it } from 'vitest';
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_SETTINGS,
  formatAltitudeMeters,
  formatDistanceKm,
  formatSpeedKmh,
  readAppSettings,
  useAppSettingsStore,
} from './appSettingsStore';

describe('appSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppSettingsStore.setState({ settings: DEFAULT_APP_SETTINGS });
  });

  it('persists settings using the existing localStorage shape', () => {
    useAppSettingsStore.getState().setSettings((settings) => ({
      ...settings,
      units: { ...settings.units, distance: 'miles' },
      favoriteSites: ['arguel'],
    }));

    const stored = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}')).toMatchObject({
      units: { distance: 'miles' },
      favoriteSites: ['arguel'],
    });
  });

  it('normalizes malformed persisted values', () => {
    localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        units: { distance: 'bad', altitude: 'ft', speed: 'mph' },
        language: 'en',
        notifications: { weather: false, flights: 'bad' },
        favoriteSites: ['arguel', 123],
      })
    );

    expect(readAppSettings()).toMatchObject({
      units: { distance: 'km', altitude: 'ft', speed: 'mph' },
      language: 'en',
      notifications: { weather: false, flights: true, alerts: true },
      favoriteSites: ['arguel'],
    });
  });

  it('formats configured units', () => {
    expect(formatDistanceKm(10, 'miles')).toBe('6.2 mi');
    expect(formatAltitudeMeters(100, 'ft')).toBe('328 ft');
    expect(formatSpeedKmh(100, 'mph')).toBe('62.1 mph');
  });
});
