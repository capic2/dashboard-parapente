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
  sample_data?: Record<string, unknown>
  tested_at: string  // ISO datetime
}


