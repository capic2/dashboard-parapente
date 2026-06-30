// Core domain types
// Re-export types from Zod schemas to ensure consistency between validation and types
import type { Key } from 'react-aria-components';

export type {
  Site,
  Flight,
  FlightStats,
  FlightRecords,
  DailySummary,
} from '@dashboard-parapente/shared-types';

export interface FlightFilters {
  siteId?: Key | null;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

// Weather data as returned by the API for combined endpoint
// Transformed from BackendWeatherResponseSchema in useWeather hook
export interface WeatherData {
  spot_name: string;
  para_index: number;
  score?: number;
  verdict: string;
  temperature: number;
  wind_speed: number;
  wind_direction: string;
  wind_gusts?: number;
  conditions: string;
  forecast_time: string;
  cached_at?: string | null;
  hourly_forecast?: HourlyForecastItem[];
  daily_forecast?: DailyForecastItem[];
}

export interface HourlyForecastItem {
  hour: string;
  time: string;
  temp: number;
  temperature: number;
  wind: number;
  wind_speed: number;
  wind_gust?: number;
  direction: string;
  wind_direction: string;
  wind_direction_deg?: number | null;
  conditions: string;
  precipitation: number | null;
  para_index: number;
  verdict: string;
  sources?: Record<string, Record<string, number | null>>;
  thermal_strength?: string;
  cape?: number | null;
  lifted_index?: number | null;
  cloud_cover?: number | null;
}

export interface DailyForecastItem {
  date: string;
  day_of_week: string;
  temp_min: number;
  temp_max: number;
  min_temp: number;
  max_temp: number;
  wind_avg: number;
  conditions: string;
  precipitation_prob: number | null;
  para_index: number;
  verdict: string;
}

export interface LiveWindStation {
  id: string;
  provider: string | null;
  provider_id: string | null;
  name: string;
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  distance_km: number;
  last_report_at: string | null;
  age_minutes: number | null;
  is_outdated: boolean;
  wind_avg_kmh: number | null;
  wind_min_kmh: number | null;
  wind_max_kmh: number | null;
  wind_direction_deg: number | null;
  temperature_c: number | null;
  cloud_ceiling_m: number | null;
  source_url: string | null;
}

export interface LiveWindResponse {
  site_id: string;
  site_name: string;
  source: 'spotair';
  radius_km: number;
  stations: LiveWindStation[];
}

// Form types
export interface FlightFormData {
  name?: string;
  title: string;
  site_id: string | null;
  flight_date: string;
  departure_time?: string | null;
  duration_minutes: number | null;
  max_altitude_m: number | null;
  max_speed_kmh?: number | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  notes?: string;
  description?: string;
  external_url?: string;
}
