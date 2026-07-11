import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getStaleTime } from '../../lib/cacheConfig';
import type {
  DailySummary,
  HourlyForecastItem,
  WeatherData,
} from '../../types';
import {
  BackendWeatherResponseSchema,
  DailySummarySchema,
} from '@dashboard-parapente/shared-types';
import type {
  BackendWeatherResponse,
  ConsensusHour,
  Slot,
} from '@dashboard-parapente/shared-types';

export const transformWeatherResponse = (
  data: BackendWeatherResponse
): WeatherData => {
  // Find the hour closest to current time for "Current Conditions"
  const now = new Date();
  const nowHour = now.getHours();
  const currentHourData =
    data.consensus?.find((h: ConsensusHour) => h.hour === nowHour) ||
    data.consensus?.[0];

  const currentHour = currentHourData || {
    hour: 0,
    temperature: null,
    wind_speed: null,
    wind_gust: null,
    wind_direction: null,
    precipitation: null,
    cloud_cover: null,
  };
  const metrics = data.metrics || {
    avg_temp_c: null,
    avg_wind_kmh: null,
    max_gust_kmh: null,
    total_rain_mm: null,
  };

  const formatWindDirection = (deg: number | null): string => {
    if (deg === null) return '—';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round((deg % 360) / 45) % 8;
    return directions[index];
  };

  const timeToHour = (timeStr: string | null): number | null => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    const hour = Number.parseInt(parts[0] ?? '', 10);
    return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : null;
  };

  let sunriseHour = timeToHour(data.sunrise ?? null);
  let sunsetHour = timeToHour(data.sunset ?? null);

  if (sunriseHour === null || sunsetHour === null) {
    const month = new Date().getMonth() + 1;
    if (month >= 4 && month <= 9) {
      sunriseHour = 6;
      sunsetHour = 21;
    } else {
      sunriseHour = 7;
      sunsetHour = 18;
    }
  }

  const hourToVerdict = new Map<number, string>();
  if (data.slots) {
    data.slots.forEach((slot: Slot) => {
      const verdictText =
        slot.verdict === '🟢'
          ? 'BON'
          : slot.verdict === '🟡'
            ? 'MOYEN'
            : slot.verdict === '🟠'
              ? 'LIMITE'
              : 'MAUVAIS';
      for (let h = slot.start_hour; h <= slot.end_hour; h++) {
        hourToVerdict.set(h, verdictText);
      }
    });
  }

  let hourlyForecast = (data.consensus || []).map((hour: ConsensusHour) => {
    return {
      hour: `${hour.hour}:00`,
      time: `${hour.hour}:00`,
      temp: hour.temperature ?? 0,
      temperature: hour.temperature ?? 0,
      wind: hour.wind_speed ?? 0,
      wind_speed: hour.wind_speed ?? 0,
      wind_gust: hour.wind_gust ?? 0,
      direction: formatWindDirection(hour.wind_direction),
      wind_direction: formatWindDirection(hour.wind_direction),
      wind_direction_deg: hour.wind_direction ?? null,
      conditions:
        hour.cloud_cover !== null
          ? `${Math.round(hour.cloud_cover)}% nuages`
          : 'N/A',
      precipitation: hour.precipitation ?? null,
      para_index: hour.para_index ?? 0,
      verdict: hour.verdict ?? hourToVerdict.get(hour.hour) ?? 'N/A',
      cape: hour.cape ?? null,
      lifted_index: hour.lifted_index ?? null,
      thermal_strength:
        (hour.thermal_strength?.toLowerCase() as HourlyForecastItem['thermal_strength']) ||
        'faible',
      cloud_cover: hour.cloud_cover ?? null,
      sources: hour.sources || {},
    };
  });

  if (sunriseHour !== null && sunsetHour !== null) {
    hourlyForecast = hourlyForecast.filter((h) => {
      const hourNum = parseInt(h.hour.split(':')[0], 10);
      return hourNum >= sunriseHour && hourNum <= sunsetHour;
    });
  }

  const dayDate = new Date();
  dayDate.setDate(dayDate.getDate() + (data.day_index ?? 0));
  const consensus = data.consensus || [];
  const temps = consensus
    .map((h: ConsensusHour) => h.temperature)
    .filter((t): t is number => t !== null && t !== undefined);
  const minTemp = temps.length > 0 ? Math.min(...temps) : 0;
  const maxTemp = temps.length > 0 ? Math.max(...temps) : 0;

  const buildCurrentConditions = (): string => {
    const conditions: string[] = [];
    if (
      currentHour.cloud_cover !== null &&
      currentHour.cloud_cover !== undefined
    ) {
      conditions.push(`${Math.round(currentHour.cloud_cover)}% nuages`);
    }

    const precip = currentHour.precipitation || 0;
    if (precip > 0) {
      conditions.push(`${precip.toFixed(1)}mm pluie`);
    } else {
      conditions.push('Sec');
    }

    return conditions.join(', ') || 'Conditions normales';
  };

  return {
    spot_name: data.site_name || 'Unknown',
    para_index: data.para_index || 0,
    score: data.score,
    verdict: data.verdict || 'N/A',
    temperature: currentHour.temperature ?? metrics.avg_temp_c ?? 0,
    wind_speed: currentHour.wind_speed ?? metrics.avg_wind_kmh ?? 0,
    wind_direction: formatWindDirection(currentHour.wind_direction),
    wind_direction_deg: currentHour.wind_direction ?? null,
    wind_gusts: currentHour.wind_gust ?? metrics.max_gust_kmh ?? 0,
    conditions: buildCurrentConditions(),
    forecast_time: data.cached_at || new Date().toISOString(),
    cached_at: data.cached_at ?? null,
    hourly_forecast: hourlyForecast,
    daily_forecast: [
      {
        date: dayDate.toISOString().split('T')[0],
        day_of_week: dayDate.toLocaleDateString('fr-FR', { weekday: 'short' }),
        temp_min: Math.round(minTemp),
        temp_max: Math.round(maxTemp),
        min_temp: Math.round(minTemp),
        max_temp: Math.round(maxTemp),
        wind_avg: Math.round(metrics.avg_wind_kmh ?? 0),
        conditions: data.slots_summary || data.explanation || 'N/A',
        precipitation_prob: null,
        para_index: data.para_index || 0,
        verdict: data.verdict || 'N/A',
      },
    ],
  };
};

/**
 * Create the queryFn for fetching and transforming weather data
 * Extracted so it can be reused in prefetch
 * EXPORTED for use in Forecast7Day and SiteSelector prefetch
 */
export const createWeatherQueryFn =
  (siteId: string, dayIndex: number, forceRefresh = false) =>
  async () => {
    if (!siteId) throw new Error('Site ID is required');

    // Fetch selected day first for current conditions (IMMEDIATE)
    const todayResponse = await api
      .get(`weather/${siteId}`, {
        searchParams: {
          day_index: dayIndex,
          ...(forceRefresh ? { force_refresh: true } : {}),
        },
      })
      .json();

    // Validate today's response with Zod
    const todayValidation =
      BackendWeatherResponseSchema.safeParse(todayResponse);
    if (!todayValidation.success) {
      console.error(
        '❌ Today weather validation failed:',
        todayValidation.error
      );
      throw new Error(
        `Invalid today weather: ${todayValidation.error.message}`
      );
    }

    return transformWeatherResponse(todayValidation.data);
  };

/**
 * Main weather hook - combines current + forecast
 * Transforms backend API response to frontend WeatherData format
 * OPTIMIZED: Loads selected day immediately, prefetches others in background
 */
export const useWeather = (siteId: string | undefined, dayIndex = 0) => {
  return useQuery({
    queryKey: ['weather', 'combined', siteId, dayIndex],
    queryFn: siteId
      ? createWeatherQueryFn(siteId, dayIndex)
      : () => {
          throw new Error('Site ID required');
        },
    staleTime: getStaleTime(1000 * 60 * 30), // 30 minutes - weather forecasts don't change that fast
    enabled: !!siteId,
  });
};

export const createDailySummaryQueryFn =
  (siteId: string, forceRefresh = false) =>
  async () => {
    if (!siteId) throw new Error('Site ID is required');
    const data = await api
      .get(`weather/${siteId}/daily-summary`, {
        searchParams: {
          days: 7,
          ...(forceRefresh ? { force_refresh: true } : {}),
        },
      })
      .json();
    return DailySummarySchema.parse(data);
  };

/**
 * Hook to fetch daily summary for 7 days (lightweight, no hourly data)
 * MUCH faster than useWeather - used for 7-day forecast cards
 *
 * This hook fetches aggregate daily data without hourly details:
 * - All sources in parallel (same data quality)
 * - Daily aggregates only (para_index, temps, wind_avg)
 * - 2-3x faster than full hourly forecast
 * - Perfect for displaying forecast cards
 */
export const useDailySummary = (
  siteId: string | undefined
): UseQueryResult<DailySummary, Error> => {
  return useQuery({
    queryKey: ['weather', 'daily-summary', siteId],
    queryFn: siteId
      ? createDailySummaryQueryFn(siteId)
      : () => {
          throw new Error('Site ID required');
        },
    staleTime: getStaleTime(1000 * 60 * 30), // 30 minutes - daily summaries don't change fast
    enabled: !!siteId,
  });
};
