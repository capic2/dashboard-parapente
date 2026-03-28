// Core domain types
// Re-export types from Zod schemas to ensure consistency between validation and types
export type {
  Site,
  Flight,
  FlightStats,
  FlightRecords,
  DailySummary,
} from '@dashboard-parapente/shared-types';

export interface FlightFilters {
  siteId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

// Weather data as returned by the API for combined endpoint
// Transformed from BackendWeatherResponseSchema in useWeather hook
export interface WeatherData {
  spot_name: string;
  para_index: number;
  verdict: string;
  temperature: number;
  wind_speed: number;
  wind_direction: string;
  wind_gusts?: number;
  conditions: string;
  forecast_time: string;
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
  conditions: string;
  precipitation: number;
  para_index: number;
  verdict: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sources?: Record<string, any>;
  thermal_strength?: 'faible' | 'modérée' | 'forte';
  cape?: number;
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
  precipitation_prob: number;
  para_index: number;
  verdict: string;
}

// Form types
export interface FlightFormData {
  name?: string;
  title: string;
  site_id: string | null;
  flight_date: string;
  departure_time?: string | null;
  duration_minutes: number;
  max_altitude_m: number;
  max_speed_kmh?: number;
  distance_km: number;
  elevation_gain_m: number;
  notes?: string;
  description?: string;
  external_url?: string;
}
