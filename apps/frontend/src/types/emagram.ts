/**
 * Emagram (Sounding) Analysis Types
 * AI-powered thermal forecasting from radiosonde data
 */

export interface EmagramAnalysis {
  id: string;
  
  // Metadata
  analysis_date: string; // ISO date
  analysis_time: string; // HH:MM
  analysis_datetime: string; // ISO datetime
  station_code: string;
  station_name: string;
  station_latitude: number;
  station_longitude: number;
  distance_km: number;
  
  // Data source
  data_source: string;
  sounding_time: string; // "00Z" or "12Z"
  llm_provider: string | null;
  llm_model: string | null;
  llm_tokens_used: number | null;
  llm_cost_usd: number | null;
  analysis_method: 'llm_vision' | 'classic_calculation';
  
  // Thermal metrics
  plafond_thermique_m: number | null; // Thermal ceiling
  force_thermique_ms: number | null; // Thermal strength in m/s
  cape_jkg: number | null; // CAPE in J/kg
  stabilite_atmospherique: string | null;
  cisaillement_vent: string | null;
  heure_debut_thermiques: string | null; // HH:MM
  heure_fin_thermiques: string | null; // HH:MM
  heures_volables_total: number | null;
  risque_orage: string | null;
  score_volabilite: number | null; // 0-100
  
  // AI summaries
  resume_conditions: string | null;
  conseils_vol: string | null;
  alertes_securite: string | null; // JSON string array
  
  // Classic meteorology indices
  lcl_m: number | null;
  lfc_m: number | null;
  el_m: number | null;
  lifted_index: number | null;
  k_index: number | null;
  total_totals: number | null;
  showalter_index: number | null;
  wind_shear_0_3km_ms: number | null;
  wind_shear_0_6km_ms: number | null;
  
  // Storage paths
  skewt_image_path: string | null;
  raw_sounding_data: string | null;
  ai_raw_response: string | null;
  
  // Status
  analysis_status: string;
  error_message: string | null;
  
  // Computed properties
  is_from_llm: boolean;
  has_thermal_data: boolean;
  flyable_hours_formatted: string | null;
  
  // Multi-source support (Gemini multi-emagram analysis)
  external_source_urls?: string | null; // JSON: {"meteo-parapente": "url", ...}
  screenshot_paths?: string | null; // JSON: {"meteo-parapente": "/path/to/screenshot.png", ...}
  sources_count?: number | null; // Number of sources analyzed
  sources_agreement?: string | null; // "high", "medium", "low"
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface EmagramListItem {
  id: string;
  analysis_date: string;
  analysis_time: string;
  station_code: string;
  station_name: string;
  distance_km: number;
  score_volabilite: number | null;
  plafond_thermique_m: number | null;
  force_thermique_ms: number | null;
  heures_volables_total: number | null;
  analysis_method: string;
  analysis_status: string;
  created_at: string;
}

// Parsed alerts (from JSON string)
type SafetyAlert = string;

// Helper to parse alertes_securite
export function parseAlerts(alertes_securite: string | null): SafetyAlert[] {
  if (!alertes_securite) return [];
  
  try {
    const parsed = JSON.parse(alertes_securite);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Score categories
type ScoreCategory = 'excellent' | 'good' | 'moderate' | 'poor' | 'unflyable';

export function getScoreCategory(score: number | null): ScoreCategory {
  if (score === null) return 'unflyable';
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'poor';
  return 'unflyable';
}

export function getScoreColor(score: number | null): string {
  const category = getScoreCategory(score);
  
  switch (category) {
    case 'excellent': return '#22c55e'; // green-500
    case 'good': return '#84cc16'; // lime-500
    case 'moderate': return '#eab308'; // yellow-500
    case 'poor': return '#f97316'; // orange-500
    case 'unflyable': return '#ef4444'; // red-500
  }
}
