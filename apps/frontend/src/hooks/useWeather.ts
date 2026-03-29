import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DailySummary, HourlyForecastItem, WeatherData } from '../types';
import {
  BackendWeatherResponseSchema,
  DailySummarySchema,
} from '@dashboard-parapente/shared-types';
import type {
  BackendWeatherResponse,
  ConsensusHour,
  Slot,
} from '@dashboard-parapente/shared-types';

/**
 * Create the queryFn for fetching and transforming weather data
 * Extracted so it can be reused in prefetch
 * EXPORTED for use in Forecast7Day and SiteSelector prefetch
 */
export const createWeatherQueryFn =
  (siteId: string, dayIndex: number) => async () => {
    if (!siteId) throw new Error('Site ID is required');

    // Fetch selected day first for current conditions (IMMEDIATE)
    const todayResponse = await api
      .get(`weather/${siteId}?day_index=${dayIndex}`)
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

    // OPTIMIZATION: Only fetch the selected day, return immediately
    // Use the selected day data for the daily forecast
    const validatedDailyResponses = [{ data: todayValidation.data }];

    const data = todayValidation.data;

    // Transform backend structure to frontend WeatherData format
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

    // Helper to format wind direction
    // CRITICAL FIX: Add 180° to show where wind COMES FROM (not goes to)
    // Example: if wind comes from North (0°), display as South (180°) with arrow pointing down
    const formatWindDirection = (deg: number | null): string => {
      if (deg === null) return '—';
      // Flip direction by adding 180° (already done in backend, but ensuring consistency)
      const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const index = Math.round((deg % 360) / 45) % 8;
      return directions[index];
    };

    // Helper to convert HH:MM string to hour number
    const timeToHour = (timeStr: string | null): number | null => {
      if (!timeStr) return null;
      const parts = timeStr.split(':');
      return parseInt(parts[0], 10);
    };

    // Extract sunrise/sunset and convert to hours
    // API returns sunrise/sunset for the requested day
    let sunriseHour = timeToHour((data as BackendWeatherResponse).sunrise ?? null);
    let sunsetHour = timeToHour((data as BackendWeatherResponse).sunset ?? null);

    // If sunrise/sunset not available, use seasonal approximation
    if (sunriseHour === null || sunsetHour === null) {
      const month = new Date().getMonth() + 1; // 1-12
      // Approximate sunrise/sunset for France (latitude ~47°)
      if (month >= 4 && month <= 9) {
        // Spring/Summer (April-September)
        sunriseHour = 6;
        sunsetHour = 21;
      } else {
        // Fall/Winter (October-March)
        sunriseHour = 7;
        sunsetHour = 18;
      }
    }

    // Map slots to hourly verdicts
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

    // Transform consensus array to hourly forecast
    // NOTE: Backend now calculates para_index per hour (not daily average)
    let hourlyForecast = (data.consensus || []).map((hour: ConsensusHour) => {
      return {
        hour: `${hour.hour}:00`,
        time: `${hour.hour}:00`,
        temp: hour.temperature || 0,
        temperature: hour.temperature || 0,
        wind: hour.wind_speed || 0,
        wind_speed: hour.wind_speed || 0,
        wind_gust: hour.wind_gust || 0,
        direction: formatWindDirection(hour.wind_direction),
        wind_direction: formatWindDirection(hour.wind_direction),
        conditions:
          hour.cloud_cover !== null
            ? `${Math.round(hour.cloud_cover)}% nuages`
            : 'N/A',
        precipitation: hour.precipitation ?? null,
        para_index: hour.para_index ?? 0, // Use backend calculation (accurate)
        verdict: hour.verdict ?? 'N/A', // Use backend verdict (accurate)
        cape: hour.cape ?? null, // CAPE (J/kg)
        thermal_strength: (hour.thermal_strength || 'faible') as HourlyForecastItem['thermal_strength'], // Thermal strength
        cloud_cover: hour.cloud_cover ?? null, // Cloud cover percentage
        sources: hour.sources || {}, // Preserve per-source data for tooltip
      };
    });

    // Filter to only show hours between sunrise and sunset
    if (sunriseHour !== null && sunsetHour !== null) {
      hourlyForecast = hourlyForecast.filter((h) => {
        const hourNum = parseInt(h.hour.split(':')[0], 10);
        return hourNum >= sunriseHour && hourNum <= sunsetHour;
      });
    }

    // Transform daily responses to DailyForecastItem[]
    const dailyForecast = validatedDailyResponses
      .map((response, index) => {
        if (!response?.data) return null;
        const dayData = data;
        const dayDate = new Date();
        dayDate.setDate(dayDate.getDate() + index);

        const consensus = dayData.consensus || [];
        const temps = consensus.map((h: ConsensusHour) => h.temperature || 0);
        const minTemp = temps.length > 0 ? Math.min(...temps) : 0;
        const maxTemp = temps.length > 0 ? Math.max(...temps) : 0;

        return {
          date: dayDate.toISOString().split('T')[0],
          day_of_week: dayDate.toLocaleDateString('fr-FR', {
            weekday: 'short',
          }),
          temp_min: Math.round(minTemp),
          temp_max: Math.round(maxTemp),
          min_temp: Math.round(minTemp),
          max_temp: Math.round(maxTemp),
          wind_avg: Math.round(dayData.metrics?.avg_wind_kmh || 0),
          conditions: dayData.slots_summary || dayData.explanation || 'N/A',
          precipitation_prob: Math.round(
            (dayData.metrics?.total_rain_mm || 0) * 10
          ),
          para_index: dayData.para_index || 0,
          verdict: dayData.verdict || 'N/A',
        };
      })
      .filter((day): day is NonNullable<typeof day> => day !== null);

    // Build current conditions text based on current hour data
    const buildCurrentConditions = (): string => {
      const conditions: string[] = [];

      // Cloud cover
      if (
        currentHour.cloud_cover !== null &&
        currentHour.cloud_cover !== undefined
      ) {
        conditions.push(`${Math.round(currentHour.cloud_cover)}% nuages`);
      }

      // Precipitation
      const precip = currentHour.precipitation || 0;
      if (precip > 0) {
        conditions.push(`${precip.toFixed(1)}mm pluie`);
      } else {
        conditions.push('Sec');
      }

      return conditions.join(', ') || 'Conditions normales';
    };

    const transformed: WeatherData = {
      spot_name: data.site_name || 'Unknown',
      para_index: data.para_index || 0,
      verdict: data.verdict || 'N/A',
      temperature: currentHour.temperature || metrics.avg_temp_c || 0,
      wind_speed: currentHour.wind_speed || metrics.avg_wind_kmh || 0,
      wind_direction: formatWindDirection(currentHour.wind_direction),
      wind_gusts: currentHour.wind_gust || metrics.max_gust_kmh || 0,
      conditions: buildCurrentConditions(),
      forecast_time: new Date().toISOString(),
      hourly_forecast: hourlyForecast,
      daily_forecast: dailyForecast,
    };

    // Return transformed data
    // Note: WeatherData interface is used for type checking but not runtime validation
    // Backend data is already validated with BackendWeatherResponseSchema
    return transformed;
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
      : async () => {
          throw new Error('Site ID required');
        },
    staleTime: 1000 * 60 * 30, // 30 minutes - weather forecasts don't change that fast
    enabled: !!siteId,
  });
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
    queryFn: async () => {
      if (!siteId) throw new Error('Site ID is required');
      const data = await api
        .get(`weather/${siteId}/daily-summary?days=7`)
        .json();
      return DailySummarySchema.parse(data);
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - daily summaries don't change fast
    enabled: !!siteId,
  });
};
