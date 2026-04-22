import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutateSpy = vi.fn();
const setFreshnessLevel = vi.fn();
const setAutoRefreshWeather = vi.fn();
const setHttpTimeout = vi.fn();
const setThemePreference = vi.fn();
const changeLanguage = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage },
  }),
  withTranslation: () => (Component: unknown) => Component,
}));

vi.mock('../hooks/settings/useAppSettings', () => ({
  useAppSettings: () => ({
    data: {
      para_wind_very_low_max: '3',
    },
  }),
  useUpdateAppSettings: () => ({
    mutate: mutateSpy,
    isPending: false,
    isError: false,
  }),
}));

vi.mock('../stores/cacheSettingsStore', () => ({
  useCacheSettingsStore: () => ({
    freshnessLevel: 'normal',
    autoRefreshWeather: true,
    httpTimeout: 30000,
    setFreshnessLevel,
    setAutoRefreshWeather,
    setHttpTimeout,
  }),
}));

vi.mock('../stores/themeStore', () => ({
  useThemeStore: () => ({
    preference: 'light',
    setPreference: setThemePreference,
  }),
}));

vi.mock('../hooks/sites/useSites', () => ({
  sitesQueryOptions: () => ({}),
}));

vi.mock('../hooks/weather/useWeatherSources', () => ({
  useWeatherSources: () => ({ data: [], isLoading: false, error: null }),
  useWeatherSourceStats: () => ({ data: [] }),
  useDeleteWeatherSource: () => vi.fn(),
}));

import Settings from './Settings';

describe('Settings threshold autosave', () => {
  beforeEach(() => {
    mutateSpy.mockClear();
    setFreshnessLevel.mockClear();
    setAutoRefreshWeather.mockClear();
    setHttpTimeout.mockClear();
    setThemePreference.mockClear();
    changeLanguage.mockClear();
    localStorage.clear();
  });

  it('autosaves a threshold input on blur', () => {
    render(<Settings />);

    const inputs = screen.getAllByRole('spinbutton');
    const windInput = inputs.find(
      (input) => input.getAttribute('value') === '3'
    );

    expect(windInput).toBeDefined();

    fireEvent.change(windInput as HTMLInputElement, {
      target: { value: '4' },
    });
    fireEvent.blur(windInput as HTMLInputElement);

    expect(mutateSpy).toHaveBeenCalledWith({
      para_wind_very_low_max: '4',
    });
  });
});
