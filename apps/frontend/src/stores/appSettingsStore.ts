import { create } from 'zustand';

export type DistanceUnit = 'km' | 'miles';
export type AltitudeUnit = 'm' | 'ft';
export type SpeedUnit = 'kmh' | 'mph';
export type ThemePreferenceSetting = 'light' | 'dark' | 'auto';

export interface AppSettings {
  units: {
    distance: DistanceUnit;
    altitude: AltitudeUnit;
    speed: SpeedUnit;
  };
  language: 'fr' | 'en';
  theme: ThemePreferenceSetting;
  notifications: {
    weather: boolean;
    flights: boolean;
    alerts: boolean;
  };
  favoriteSites: string[];
}

export const APP_SETTINGS_STORAGE_KEY = 'paragliding-settings';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  units: {
    distance: 'km',
    altitude: 'm',
    speed: 'kmh',
  },
  language: 'fr',
  theme: 'light',
  notifications: {
    weather: true,
    flights: true,
    alerts: true,
  },
  favoriteSites: [],
};

type AppSettingsStore = {
  settings: AppSettings;
  setSettings: (
    updater: AppSettings | ((settings: AppSettings) => AppSettings)
  ) => void;
  resetSettings: () => void;
};

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) return DEFAULT_APP_SETTINGS;

  const units = isRecord(value.units) ? value.units : {};
  const notifications = isRecord(value.notifications)
    ? value.notifications
    : {};

  return {
    units: {
      distance: units.distance === 'miles' ? 'miles' : 'km',
      altitude: units.altitude === 'ft' ? 'ft' : 'm',
      speed: units.speed === 'mph' ? 'mph' : 'kmh',
    },
    language: value.language === 'en' ? 'en' : 'fr',
    theme:
      value.theme === 'dark' || value.theme === 'auto' ? value.theme : 'light',
    notifications: {
      weather:
        typeof notifications.weather === 'boolean'
          ? notifications.weather
          : DEFAULT_APP_SETTINGS.notifications.weather,
      flights:
        typeof notifications.flights === 'boolean'
          ? notifications.flights
          : DEFAULT_APP_SETTINGS.notifications.flights,
      alerts:
        typeof notifications.alerts === 'boolean'
          ? notifications.alerts
          : DEFAULT_APP_SETTINGS.notifications.alerts,
    },
    favoriteSites: Array.isArray(value.favoriteSites)
      ? value.favoriteSites.filter(
          (siteId): siteId is string => typeof siteId === 'string'
        )
      : [],
  };
}

export function readAppSettings(
  storage: Pick<Storage, 'getItem'> | null = getStorage()
): AppSettings {
  if (!storage) return DEFAULT_APP_SETTINGS;

  try {
    return normalizeSettings(
      JSON.parse(storage.getItem(APP_SETTINGS_STORAGE_KEY) ?? 'null')
    );
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

function writeAppSettings(settings: AppSettings) {
  getStorage()?.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function formatDistanceKm(valueKm: number, unit: DistanceUnit): string {
  if (unit === 'miles') {
    return `${(valueKm * 0.621371).toFixed(1)} mi`;
  }

  return `${valueKm.toFixed(1)} km`;
}

export function formatAltitudeMeters(
  valueMeters: number,
  unit: AltitudeUnit
): string {
  if (unit === 'ft') {
    return `${Math.round(valueMeters * 3.28084)} ft`;
  }

  return `${Math.round(valueMeters)} m`;
}

export function formatSpeedKmh(valueKmh: number, unit: SpeedUnit): string {
  if (unit === 'mph') {
    return `${(valueKmh * 0.621371).toFixed(1)} mph`;
  }

  return `${valueKmh.toFixed(1)} km/h`;
}

export const useAppSettingsStore = create<AppSettingsStore>((set) => ({
  settings: readAppSettings(),
  setSettings: (updater) =>
    set((state) => {
      const nextSettings =
        typeof updater === 'function' ? updater(state.settings) : updater;
      const normalizedSettings = normalizeSettings(nextSettings);
      writeAppSettings(normalizedSettings);
      return { settings: normalizedSettings };
    }),
  resetSettings: () => {
    getStorage()?.removeItem(APP_SETTINGS_STORAGE_KEY);
    set({ settings: DEFAULT_APP_SETTINGS });
  },
}));
