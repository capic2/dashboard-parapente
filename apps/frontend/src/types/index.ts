// Core domain types
// Re-export types from Zod schemas to ensure consistency between validation and types
export type { 
  Site, 
  Flight, 
  FlightStats, 
  FlightRecord,
  FlightRecords,
  DailySummary, 
  DailySummaryDay,
  GeoPoint,
  GPXData,
  ParaglidingSpotBase,
  ParaglidingSpotSearchResult,
  SpotSearchResponse,
  GeocodeResponse,
} from '@dashboard-parapente/shared-types';

export interface FlightFilters {
  siteId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface Alert {
  id: string;
  user_id: string;
  name: string;
  site_id: string;
  condition_type:
    | 'wind'
    | 'wind_direction'
    | 'rain'
    | 'cloud_base'
    | 'temperature';
  operator: '>' | '<' | '=' | 'between';
  threshold_min: number;
  threshold_max: number;
  is_active: boolean;
  notify_via: 'telegram' | 'email' | 'both';
  created_at: string;
  updated_at: string;
}

export interface AlertHistory {
  id: string;
  alert_id: string;
  triggered_at: string;
  condition_value: number;
  message: string;
  alert?: Alert;
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
export interface AlertFormData {
  name: string;
  site_id: string;
  condition_type: Alert['condition_type'];
  operator: Alert['operator'];
  threshold_min: number;
  threshold_max: number;
  is_active: boolean;
  notify_via: Alert['notify_via'];
}

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

// API response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}
