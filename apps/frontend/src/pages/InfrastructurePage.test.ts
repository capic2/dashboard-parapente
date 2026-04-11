import { describe, expect, it } from 'vitest';

import { getResolvedLabel } from './InfrastructurePage';

describe('getResolvedLabel', () => {
  const t = (key: string, options: Record<string, unknown> = {}): string => {
    const translations: Record<string, string> = {
      'cache.noResolution': 'No semantic resolution',
      'cache.resolvedBestSpot': `Best Spot (day ${(options.day as string) ?? ''})`,
      'cache.resolvedWeatherForecast': 'Weather forecast',
      'cache.resolvedWeatherForecastWithSite': `Weather forecast for ${(options.site as string) ?? ''} (day ${(options.day as string) ?? ''})`,
      'cache.resolvedEmagram': `Emagram sounding for station ${(options.station as string) ?? ''} (${(options.date as string) ?? ''})`,
      'cache.resolutionGeneric': 'Unknown key type',
    };

    return translations[key];
  };

  it('returns no-resolution message for null', () => {
    expect(getResolvedLabel(null, t)).toBe('No semantic resolution');
  });

  it('formats best spot resolution', () => {
    expect(
      getResolvedLabel(
        {
          type: 'best_spot',
          label: 'best_spot_for_day',
          confidence: 'high',
          details: {
            day_index: 2,
          },
        },
        t
      )
    ).toBe('Best Spot (day 2)');
  });

  it('formats weather forecast with site details', () => {
    expect(
      getResolvedLabel(
        {
          type: 'weather_forecast',
          label: 'weather_forecast',
          confidence: 'high',
          details: {
            site_name: 'Arguel',
            day_index: 0,
          },
        },
        t
      )
    ).toBe('Weather forecast for Arguel (day 0)');
  });

  it('falls back to generic weather forecast text if site details are missing', () => {
    expect(
      getResolvedLabel(
        {
          type: 'weather_forecast',
          label: 'weather_forecast',
          confidence: 'high',
          details: {
            day_index: 1,
          },
        },
        t
      )
    ).toBe('Weather forecast');
  });

  it('formats emagram sounding with station and date', () => {
    expect(
      getResolvedLabel(
        {
          type: 'emagram_sounding',
          label: 'emagram_sounding',
          confidence: 'high',
          details: {
            station: '07145',
            date: '2026-01-15',
            sounding_hour: '12',
          },
        },
        t
      )
    ).toBe('Emagram sounding for station 07145 (2026-01-15)');
  });

  it('falls back to generic label for unknown type', () => {
    expect(
      getResolvedLabel(
        {
          type: 'some_type',
          label: 'unsupported_label',
          confidence: 'low',
        },
        t
      )
    ).toBe('Unknown key type');
  });
});
