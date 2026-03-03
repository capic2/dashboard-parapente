/**
 * Zod schemas for API response validation
 * Validates ALL API responses before use in React components
 */

import { z } from 'zod'

// ============================================================================
// CORE DOMAIN SCHEMAS
// ============================================================================

export const SiteSchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  elevation_m: z.number().nullable().optional(),
  region: z.string().nullable().optional(),
  country: z.string().nullable().optional().default('FR'),
  rating: z.number().nullable().optional(),
  orientation: z.string().nullable().optional(),
  linked_spot_id: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  // Legacy fields kept for backward compatibility
  description: z.string().optional().catch(''),
  difficulty_level: z.string().optional().catch(''),
  is_active: z.boolean().optional().default(true),
})

export const FlightSchema = z.object({
  id: z.string(),
  user_id: z.string().optional(),
  site_id: z.string(),
  site_name: z.string().optional(),
  title: z.string(),
  flight_date: z.string(),
  duration_minutes: z.number(),
  max_altitude_m: z.number(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  notes: z.string().nullable().optional(),
  gpx_file_path: z.string().nullable().optional(),
  site: SiteSchema.optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const FlightStatsSchema = z.object({
  total_flights: z.number().catch(0),
  total_hours: z.number().catch(0),
  total_duration_minutes: z.number().catch(0),
  total_distance: z.number().catch(0),
  total_distance_km: z.number().catch(0),
  total_elevation_gain_m: z.number().catch(0),
  avg_duration: z.number().catch(0),
  avg_duration_minutes: z.number().catch(0),
  avg_distance_km: z.number().catch(0),
  max_altitude_m: z.number().catch(0),
  favorite_spot: z.string().nullable().optional(),
  favorite_site: SiteSchema.nullable(),
  last_flight_date: z.string().nullable().optional(),
})

export const AlertSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  site_id: z.string(),
  condition_type: z.enum(['wind', 'wind_direction', 'rain', 'cloud_base', 'temperature']),
  operator: z.enum(['>', '<', '=', 'between']),
  threshold_min: z.number(),
  threshold_max: z.number(),
  is_active: z.boolean().catch(true),
  notify_via: z.enum(['telegram', 'email', 'both']),
  created_at: z.string().catch(''),
  updated_at: z.string().catch(''),
})

export const AlertHistorySchema = z.object({
  id: z.string(),
  alert_id: z.string(),
  triggered_at: z.string(),
  condition_value: z.number(),
  message: z.string(),
  alert: AlertSchema.optional(),
})

// ============================================================================
// WEATHER SCHEMAS
// ============================================================================

export const WeatherConditionsSchema = z.object({
  site_id: z.string(),
  timestamp: z.string(),
  temperature_c: z.number(),
  wind_speed_kmh: z.number(),
  wind_gust_kmh: z.number(),
  wind_direction_deg: z.number(),
  precipitation_mm: z.number(),
  cloud_cover_percent: z.number(),
  cloud_base_m: z.number(),
  humidity_percent: z.number(),
  pressure_hpa: z.number(),
  visibility_km: z.number(),
})

export const ForecastHourSchema = z.object({
  time: z.string(),
  temperature_c: z.number(),
  wind_speed_kmh: z.number(),
  wind_gust_kmh: z.number(),
  wind_direction_deg: z.number(),
  precipitation_mm: z.number(),
  precipitation_probability_percent: z.number(),
  cloud_cover_percent: z.number(),
  cloud_base_m: z.number(),
})

export const ForecastDaySchema = z.object({
  date: z.string(),
  hours: z.array(ForecastHourSchema),
  max_temp_c: z.number(),
  min_temp_c: z.number(),
  precipitation_total_mm: z.number(),
  avg_wind_speed_kmh: z.number(),
})

export const WeatherSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider_type: z.enum(['meteo_france', 'open_meteo', 'windy', 'custom']),
  is_active: z.boolean().catch(true),
  api_config: z.record(z.string(), z.any()).optional(),
  created_at: z.string().catch(''),
})

// ============================================================================
// COMBINED WEATHER API RESPONSE SCHEMAS (for main useWeather hook)
// ============================================================================

export const HourlyForecastItemSchema = z.object({
  hour: z.string(),
  time: z.string(),
  temp: z.number(),
  temperature: z.number(),
  wind: z.number(),
  wind_speed: z.number(),
  wind_gust: z.number().optional(),
  direction: z.string(),
  wind_direction: z.string(),
  conditions: z.string(),
  precipitation: z.number(),
  para_index: z.number(),
  verdict: z.string(),
  sources: z.record(z.string(), z.any()).optional(), // Per-source weather data
}).passthrough() // Keep all extra fields

export const DailyForecastItemSchema = z.object({
  date: z.string(),
  day_of_week: z.string(),
  temp_min: z.number(),
  temp_max: z.number(),
  min_temp: z.number(),
  max_temp: z.number(),
  wind_avg: z.number(),
  conditions: z.string(),
  precipitation_prob: z.number(),
  para_index: z.number(),
  verdict: z.string(),
})

export const WeatherDataSchema = z.object({
  spot_name: z.string(),
  para_index: z.number(),
  verdict: z.string(),
  temperature: z.number(),
  wind_speed: z.number(),
  wind_direction: z.string(),
  wind_gusts: z.number().optional(),
  conditions: z.string(),
  forecast_time: z.string(),
  hourly_forecast: z.array(HourlyForecastItemSchema).optional(),
  daily_forecast: z.array(DailyForecastItemSchema).optional(),
})

// ============================================================================
// BACKEND API RESPONSE SCHEMAS (raw API format before transformation)
// ============================================================================

export const ConsensusHourSchema = z.object({
  hour: z.number(),
  num_sources: z.number().optional(),
  temperature: z.number().nullable(),
  temperature_confidence: z.number().optional(),
  wind_speed: z.number().nullable(),
  wind_confidence: z.number().optional(),
  wind_gust: z.number().nullable(),
  gust_confidence: z.number().optional(),
  wind_direction: z.number().nullable(),
  direction_confidence: z.number().optional(),
  precipitation: z.number().nullable(),
  precipitation_confidence: z.number().optional(),
  cloud_cover: z.number().nullable(),
  cloud_confidence: z.number().optional(),
  cape: z.number().nullable().optional(),
  cape_confidence: z.number().optional(),
  lifted_index: z.number().nullable().optional(),
  li_confidence: z.number().optional(),
  sources: z.record(z.string(), z.any()).optional(), // Per-source data for tooltip
}).passthrough() // Keep all extra fields from API response

export const SlotSchema = z.object({
  start_hour: z.number(),
  end_hour: z.number(),
  verdict: z.string(),
  reason: z.string().nullish().default(''),
})

export const MetricsSchema = z.object({
  avg_temp_c: z.number().nullable(),
  avg_wind_kmh: z.number().nullable(),
  max_gust_kmh: z.number().nullable(),
  total_rain_mm: z.number().nullable(),
})

export const BackendWeatherResponseSchema = z.object({
  site_id: z.string().catch(''),
  site_name: z.string().catch(''),
  day_index: z.number().catch(0),
  para_index: z.number().catch(0),
  verdict: z.string().catch(''),
  explanation: z.string().catch(''),
  slots_summary: z.string().catch(''),
  consensus: z.array(ConsensusHourSchema).optional(),
  slots: z.array(SlotSchema).optional(),
  metrics: MetricsSchema.optional(),
}).passthrough()

// ============================================================================
// API WRAPPER SCHEMA
// ============================================================================

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    message: z.string().optional(),
    status: z.enum(['success', 'error']),
  })

// ============================================================================
// SPECIALIZED API RESPONSE SCHEMAS
// ============================================================================

export const SitesApiResponseSchema = z.object({
  sites: z.array(SiteSchema),
})

export const FlightsApiResponseSchema = z.object({
  flights: z.array(FlightSchema),
})

// ============================================================================
// TYPE EXPORTS (inferred from Zod schemas)
// ============================================================================

export type Site = z.infer<typeof SiteSchema>
export type Flight = z.infer<typeof FlightSchema>
export type FlightStats = z.infer<typeof FlightStatsSchema>
export type Alert = z.infer<typeof AlertSchema>
export type AlertHistory = z.infer<typeof AlertHistorySchema>
export type WeatherConditions = z.infer<typeof WeatherConditionsSchema>
export type ForecastHour = z.infer<typeof ForecastHourSchema>
export type ForecastDay = z.infer<typeof ForecastDaySchema>
export type WeatherSource = z.infer<typeof WeatherSourceSchema>
export type WeatherData = z.infer<typeof WeatherDataSchema>
export type HourlyForecastItem = z.infer<typeof HourlyForecastItemSchema>
export type DailyForecastItem = z.infer<typeof DailyForecastItemSchema>
export type BackendWeatherResponse = z.infer<typeof BackendWeatherResponseSchema>
export type ConsensusHour = z.infer<typeof ConsensusHourSchema>
export type Slot = z.infer<typeof SlotSchema>
export type Metrics = z.infer<typeof MetricsSchema>
