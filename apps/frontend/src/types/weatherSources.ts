/**
 * Type definitions for Weather Source Configuration
 * Matches backend schemas for weather source management
 */

export type WeatherSourceStatus = 'active' | 'error' | 'disabled' | 'unknown'

export type ScraperType = 'api' | 'playwright' | 'stealth'

export interface WeatherSource {
  id: string
  source_name: string  // "open-meteo", "weatherapi", etc.
  display_name: string  // "Open-Meteo", "WeatherAPI.com", etc.
  description: string | null
  is_enabled: boolean
  requires_api_key: boolean
  api_key_configured: boolean  // true if API key present (or not required)
  priority: number
  scraper_type: ScraperType
  base_url: string | null
  documentation_url: string | null
  
  // Statistics
  last_success_at: string | null  // ISO datetime
  last_error_at: string | null
  last_error_message: string | null
  success_count: number
  error_count: number
  success_rate: number  // 0-100%
  avg_response_time_ms: number | null
  
  // Derived status
  status: WeatherSourceStatus
  
  // Timestamps
  created_at: string  // ISO datetime
  updated_at: string
}

export interface WeatherSourceUpdate {
  display_name?: string
  description?: string | null
  is_enabled?: boolean
  api_key?: string | null
  priority?: number
  base_url?: string | null
  documentation_url?: string | null
}

export interface WeatherSourceCreate {
  source_name: string
  display_name: string
  description?: string | null
  is_enabled?: boolean
  requires_api_key?: boolean
  api_key?: string | null
  priority?: number
  scraper_type: ScraperType
  base_url?: string | null
  documentation_url?: string | null
}

export interface WeatherSourceStats {
  total_sources: number
  active_sources: number
  disabled_sources: number
  sources_with_errors: number
  global_success_rate: number
  global_avg_response_time_ms: number | null
}

export interface WeatherSourceTestResult {
  success: boolean
  response_time_ms: number
  error?: string
  sample_data?: Record<string, any>
  tested_at: string  // ISO datetime
}

/**
 * Emagram source result in aggregator response
 * Note: forecast_hour is now provider-specific (not at root level)
 */
export interface EmagramSourceResult {
  source: string
  success: boolean
  forecast_hour: number | null  // Provider-specific (e.g., only Open-Meteo provides this)
  error?: string
  // Additional provider-specific fields...
}

/**
 * Emagram aggregator response structure
 * Updated: forecast_hour moved from root to per-source level
 */
export interface EmagramAggregatorResponse {
  success: boolean
  spot_name: string
  latitude: number
  longitude: number
  emagrammes: EmagramSourceResult[]
  sources_available: number
  sources_total: number
  timestamp: string  // ISO datetime
  // Note: forecast_hour removed from root - now in each emagrammes[].forecast_hour
}
