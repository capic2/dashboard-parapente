import { describe, expect, it } from 'vitest';

import { DEFAULT_UI_THRESHOLDS, getFlyabilityDisplay } from './HourlyForecast';
import type { HourlyForecastItem } from '../../types';

const baseHour: HourlyForecastItem = {
  hour: '12h',
  time: '12:00',
  temp: 15,
  temperature: 15,
  wind: 12,
  wind_speed: 12,
  wind_gust: 22,
  direction: 'N',
  wind_direction: 'N',
  wind_direction_deg: 0,
  conditions: 'clear',
  precipitation: 0.6,
  para_index: 55,
  verdict: 'MOYEN',
  sources: {
    'open-meteo': {
      cloud_cover: 20,
      wind_gust: 22,
    },
  },
};

describe('getFlyabilityDisplay', () => {
  it('uses configurable precipitation threshold for reason priority', () => {
    const displayDefault = getFlyabilityDisplay(
      baseHour,
      DEFAULT_UI_THRESHOLDS
    );
    expect(displayDefault.text).toContain('Pluie');

    const displayWithHigherRainLimit = getFlyabilityDisplay(baseHour, {
      ...DEFAULT_UI_THRESHOLDS,
      slotPrecipitationMax: 1,
    });
    expect(displayWithHigherRainLimit.text).not.toContain('Pluie');
  });

  it('keeps BON verdict unchanged', () => {
    const display = getFlyabilityDisplay(
      {
        ...baseHour,
        verdict: 'BON',
      },
      DEFAULT_UI_THRESHOLDS
    );

    expect(display.text).toBe('BON');
    expect(display.Icon).toBeTypeOf('function');
  });
});
