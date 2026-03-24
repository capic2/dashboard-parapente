/**
 * Zod schemas for API response validation
 * Validates ALL API responses before use in React components
 */

import { z } from 'zod';

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
  camera_angle: z.number().nullable().optional(),
  camera_distance: z.number().nullable().optional().default(500),
  linked_spot_id: z.string().nullable().optional(),
  flight_count: z.number().optional().default(0),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  usage_type: z.enum(['takeoff', 'landing', 'both']).optional(),
  // Legacy fields kept for backward compatibility
  description: z.string().optional().catch(''),
  difficulty_level: z.string().optional().catch(''),
  is_active: z.boolean().optional().default(true),
});

export const LandingAssociationSchema = z.object({
  id: z.string(),
  takeoff_site_id: z.string(),
  landing_site_id: z.string(),
  is_primary: z.boolean().default(false),
  distance_km: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  landing_site: SiteSchema.optional(),
  created_at: z.string().nullable().optional(),
});

export type LandingAssociation = z.infer<typeof LandingAssociationSchema>;

export const FlightSchema = z.object({
  id: z.string(),
  strava_id: z.string().nullable().optional(),
  site_id: z.string().nullable().optional(),
  site_name: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  flight_date: z.string(),
  departure_time: z.string().nullable().optional(),
  duration_minutes: z.number().nullable().optional(),
  max_altitude_m: z.number().nullable().optional(),
  max_speed_kmh: z.number().nullable().optional(),
  distance_km: z.number().nullable().optional(),
  elevation_gain_m: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  gpx_file_path: z.string().nullable().optional(),
  gpx_max_altitude_m: z.number().nullable().optional(),
  gpx_elevation_gain_m: z.number().nullable().optional(),
  external_url: z.string().nullable().optional(),
  video_export_job_id: z.string().nullable().optional(),
  video_export_status: z.enum(['processing', 'completed', 'failed']).nullable().optional(),
  video_file_path: z.string().nullable().optional(),
  site: SiteSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const FlightStatsSchema = z.object({
  total_flights: z.number().catch(0),
  total_hours: z.number().catch(0),
  total_duration_minutes: z.number().catch(0),
  total_distance_km: z.number().catch(0),
  total_elevation_gain_m: z.number().catch(0),
  avg_duration_minutes: z.number().catch(0),
  avg_distance_km: z.number().catch(0),
  max_altitude_m: z.number().catch(0),
  favorite_spot: z.string().nullable().optional(),
  favorite_site: SiteSchema.nullable(),
  last_flight_date: z.string().nullable().optional(),
});

export const AlertSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  site_id: z.string(),
  condition_type: z.enum([
    'wind',
    'wind_direction',
    'rain',
    'cloud_base',
    'temperature',
  ]),
  operator: z.enum(['>', '<', '=', 'between']),
  threshold_min: z.number(),
  threshold_max: z.number(),
  is_active: z.boolean().catch(true),
  notify_via: z.enum(['telegram', 'email', 'both']),
  created_at: z.string().catch(''),
  updated_at: z.string().catch(''),
});

export const AlertHistorySchema = z.object({
  id: z.string(),
  alert_id: z.string(),
  triggered_at: z.string(),
  condition_value: z.number(),
  message: z.string(),
  alert: AlertSchema.optional(),
});

// ============================================================================
// WEATHER SCHEMAS
// ============================================================================
// Note: ForecastHourSchema, HourlyForecastItemSchema, DailyForecastItemSchema, 
// and WeatherDataSchema have been removed as they are obsolete.
// The app now uses BackendWeatherResponseSchema directly and transforms 
// data in useWeather hook.

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
  para_index: z.number().optional(), // Para-index score per hour
  verdict: z.string().optional(), // Verdict per hour
  thermal_strength: z.string().optional(), // Thermal strength
  sources: z.record(z.string(), z.any()).optional(), // Per-source data for tooltip
});

export const SlotSchema = z.object({
  start_hour: z.number(),
  end_hour: z.number(),
  verdict: z.string(),
  reason: z.string().nullish().default(''),
});

export const MetricsSchema = z.object({
  avg_temp_c: z.number().nullable(),
  avg_wind_kmh: z.number().nullable(),
  max_gust_kmh: z.number().nullable(),
  total_rain_mm: z.number().nullable(),
});

export const BackendWeatherResponseSchema = z.object({
  site_id: z.string().catch(''),
  site_name: z.string().catch(''),
  day_index: z.number().catch(0),
  days: z.number().catch(1),
  sunrise: z.string().optional(),
  sunset: z.string().optional(),
  sources_metadata: z.record(z.string(), z.any()).optional(),
  consensus: z.array(ConsensusHourSchema).nullable().optional(),
  para_index: z.number().catch(0),
  verdict: z.string().catch(''),
  emoji: z.string().catch(''),
  explanation: z.string().catch(''),
  metrics: MetricsSchema.optional(),
  slots: z.array(SlotSchema).optional(),
  slots_summary: z.string().catch(''),
  total_sources: z.number().optional(),
});

// ============================================================================
// API WRAPPER SCHEMA
// ============================================================================

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    message: z.string().optional(),
    status: z.enum(['success', 'error']),
  });

// ============================================================================
// SPECIALIZED API RESPONSE SCHEMAS
// ============================================================================

export const SitesApiResponseSchema = z.object({
  sites: z.array(SiteSchema),
});

export const FlightsApiResponseSchema = z.object({
  flights: z.array(FlightSchema),
});

// ============================================================================
// DAILY SUMMARY SCHEMA
// ============================================================================

export const DailySummaryDaySchema = z.object({
  day_index: z.number(),
  date: z.string(),
  para_index: z.number(),
  verdict: z.string(),
  emoji: z.string(),
  temp_min: z.number(),
  temp_max: z.number(),
  wind_avg: z.number(),
});

export const DailySummarySchema = z.object({
  site_id: z.string(),
  site_name: z.string(),
  days: z.array(DailySummaryDaySchema),
});

// ============================================================================
// PARAGLIDING SPOT SEARCH SCHEMAS
// ============================================================================

export const ParaglidingSpotBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['takeoff', 'landing', 'both']),
  latitude: z.number(),
  longitude: z.number(),
  elevation_m: z.number().nullable().optional(),
  orientation: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  country: z.string().default('FR'),
  source: z.string(), // "openaip", "paraglidingspots", "merged"
});

export const ParaglidingSpotSearchResultSchema = ParaglidingSpotBaseSchema.extend({
  distance_km: z.number().nullable().optional(),
});

export const SpotSearchResponseSchema = z.object({
  query: z.record(z.string(), z.any()),
  total: z.number(),
  spots: z.array(ParaglidingSpotSearchResultSchema),
});

// ============================================================================
// GEOCODE RESPONSE SCHEMA
// ============================================================================

export const GeocodeResponseSchema = z.object({
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  display_name: z.string(),
});

// ============================================================================
// BEST SPOT SCHEMAS
// ============================================================================

export const BestSpotSiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  rating: z.number().nullable().optional(),
  orientation: z.string().nullable().optional(),
});

export const BestSpotResultSchema = z.object({
  site: BestSpotSiteSchema.nullable(),
  paraIndex: z.number(),
  windDirection: z.string().nullable().optional(),
  windSpeed: z.number().nullable().optional(),
  windFavorability: z.string().optional(),
  score: z.number().optional(),
  verdict: z.string().optional(),
  reason: z.string(),
});

// ============================================================================
// FLIGHT RECORDS SCHEMAS
// ============================================================================

export const FlightRecordSchema = z.object({
  value: z.number(),
  flight_id: z.string(),
  flight_name: z.string(),
  flight_date: z.string(),
  site_name: z.string().nullable().optional(),
});

export const FlightRecordsSchema = z.object({
  longest_duration: FlightRecordSchema.nullable().optional(),
  highest_altitude: FlightRecordSchema.nullable().optional(),
  longest_distance: FlightRecordSchema.nullable().optional(),
  max_speed: FlightRecordSchema.nullable().optional(),
});

// ============================================================================
// GPX DATA SCHEMAS
// ============================================================================

export const GeoPointSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  elevation: z.number(),
  timestamp: z.string().optional(),
});

export const GPXDataSchema = z.object({
  coordinates: z.array(GeoPointSchema),
  max_altitude_m: z.number(),
  min_altitude_m: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number(),
  total_distance_km: z.number(),
  flight_duration_seconds: z.number(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Site = z.infer<typeof SiteSchema>;
export type Flight = z.infer<typeof FlightSchema>;
export type FlightStats = z.infer<typeof FlightStatsSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type Slot = z.infer<typeof SlotSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type DailySummaryDay = z.infer<typeof DailySummaryDaySchema>;
export type DailySummary = z.infer<typeof DailySummarySchema>;
export type ParaglidingSpotBase = z.infer<typeof ParaglidingSpotBaseSchema>;
export type ParaglidingSpotSearchResult = z.infer<typeof ParaglidingSpotSearchResultSchema>;
export type SpotSearchResponse = z.infer<typeof SpotSearchResponseSchema>;
export type GeocodeResponse = z.infer<typeof GeocodeResponseSchema>;
export type FlightRecord = z.infer<typeof FlightRecordSchema>;
export type FlightRecords = z.infer<typeof FlightRecordsSchema>;
export type GeoPoint = z.infer<typeof GeoPointSchema>;
export type GPXData = z.infer<typeof GPXDataSchema>;
export type BestSpotSite = z.infer<typeof BestSpotSiteSchema>;
export type BestSpotResult = z.infer<typeof BestSpotResultSchema>;
