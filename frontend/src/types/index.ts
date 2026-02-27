// Core domain types

export interface Site {
  id: string
  name: string
  latitude: number
  longitude: number
  elevation_m: number
  description?: string
  orientation?: string
  difficulty_level?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Flight {
  id: string
  user_id: string
  site_id: string
  site_name?: string
  title: string
  flight_date: string
  duration_minutes: number
  max_altitude_m: number
  distance_km: number
  elevation_gain_m: number
  notes?: string
  gpx_file_path?: string
  site?: Site
  created_at: string
  updated_at: string
}

export interface FlightFilters {
  siteId?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}

export interface FlightStats {
  total_flights: number
  total_hours: number
  total_duration_minutes: number
  total_distance: number
  total_distance_km: number
  total_elevation_gain_m: number
  avg_duration: number
  avg_duration_minutes: number
  avg_distance_km: number
  max_altitude_m: number
  favorite_spot?: string
  favorite_site?: Site
  last_flight_date?: string
}

export interface Alert {
  id: string
  user_id: string
  name: string
  site_id: string
  condition_type: 'wind' | 'wind_direction' | 'rain' | 'cloud_base' | 'temperature'
  operator: '>' | '<' | '=' | 'between'
  threshold_min: number
  threshold_max: number
  is_active: boolean
  notify_via: 'telegram' | 'email' | 'both'
  created_at: string
  updated_at: string
}

export interface AlertHistory {
  id: string
  alert_id: string
  triggered_at: string
  condition_value: number
  message: string
  alert?: Alert
}

export interface WeatherConditions {
  site_id: string
  timestamp: string
  temperature_c: number
  wind_speed_kmh: number
  wind_gust_kmh: number
  wind_direction_deg: number
  precipitation_mm: number
  cloud_cover_percent: number
  cloud_base_m: number
  humidity_percent: number
  pressure_hpa: number
  visibility_km: number
}

export interface ForecastHour {
  time: string
  temperature_c: number
  wind_speed_kmh: number
  wind_gust_kmh: number
  wind_direction_deg: number
  precipitation_mm: number
  precipitation_probability_percent: number
  cloud_cover_percent: number
  cloud_base_m: number
}

export interface ForecastDay {
  date: string
  hours: ForecastHour[]
  max_temp_c: number
  min_temp_c: number
  precipitation_total_mm: number
  avg_wind_speed_kmh: number
}

export interface WeatherSource {
  id: string
  name: string
  provider_type: 'meteo_france' | 'open_meteo' | 'windy' | 'custom'
  is_active: boolean
  api_config?: Record<string, unknown>
  created_at: string
}

// Weather data as returned by the API for combined endpoint
export interface WeatherData {
  spot_name: string
  para_index: number
  verdict: string
  temperature: number
  wind_speed: number
  wind_direction: string
  wind_gusts?: number
  conditions: string
  forecast_time: string
  hourly_forecast?: HourlyForecastItem[]
  daily_forecast?: DailyForecastItem[]
}

export interface HourlyForecastItem {
  hour: string
  time: string
  temp: number
  temperature: number
  wind: number
  wind_speed: number
  direction: string
  wind_direction: string
  conditions: string
  precipitation: number
  para_index: number
  verdict: string
}

export interface DailyForecastItem {
  date: string
  day_of_week: string
  temp_min: number
  temp_max: number
  min_temp: number
  max_temp: number
  wind_avg: number
  conditions: string
  precipitation_prob: number
  para_index: number
  verdict: string
}

// Form types
export interface AlertFormData {
  name: string
  site_id: string
  condition_type: Alert['condition_type']
  operator: Alert['operator']
  threshold_min: number
  threshold_max: number
  is_active: boolean
  notify_via: Alert['notify_via']
}

export interface FlightFormData {
  title: string
  site_id: string
  flight_date: string
  duration_minutes: number
  max_altitude_m: number
  distance_km: number
  elevation_gain_m: number
  notes?: string
}

// API response wrapper
export interface ApiResponse<T> {
  data: T
  message?: string
  status: 'success' | 'error'
}
