-- =============================================================================
-- DASHBOARD PARAPENTE - Schema SQLite
-- =============================================================================
-- Generated: 2026-02-26
-- For: Vincent's Personal Paragliding Dashboard
-- Database: dashboard.db (local file)
-- Version: 1.0 (Design Phase - SQLite Optimized)
-- =============================================================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- =============================================================================
-- 1. CORE ENTITIES - Vols et Lieux
-- =============================================================================

-- Table: sites (Flying spots)
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,  -- UUID string
  code TEXT UNIQUE NOT NULL,  -- e.g., 'arguel', 'mont-poupet'
  name TEXT NOT NULL,
  elevation_m INTEGER NOT NULL,  -- Elevation in meters
  latitude REAL NOT NULL,  -- e.g., 47.012345
  longitude REAL NOT NULL,  -- e.g., 6.789012
  description TEXT,
  region TEXT,  -- e.g., 'Bourgogne-Franche-Comté'
  country TEXT DEFAULT 'FR',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sites_code ON sites(code);
CREATE INDEX IF NOT EXISTS idx_sites_region ON sites(region);

-- Table: flights (Vols - synchronized from Strava)
CREATE TABLE IF NOT EXISTS flights (
  id TEXT PRIMARY KEY,  -- UUID string
  strava_id TEXT UNIQUE,  -- External Strava flight ID
  site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  flight_date DATE NOT NULL,
  duration_minutes INTEGER,
  max_altitude_m INTEGER,
  max_speed_kmh REAL,
  distance_km REAL,
  elevation_gain_m INTEGER,
  notes TEXT,
  external_url TEXT,  -- Link to Strava activity
  -- Metadata
  imported_from TEXT DEFAULT 'strava',
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flights_site_id ON flights(site_id);
CREATE INDEX IF NOT EXISTS idx_flights_flight_date ON flights(flight_date DESC);
CREATE INDEX IF NOT EXISTS idx_flights_strava_id ON flights(strava_id);

-- =============================================================================
-- 2. WEATHER DATA - 8 Sources
-- =============================================================================

-- Table: weather_sources (Available weather data providers)
CREATE TABLE IF NOT EXISTS weather_sources (
  id TEXT PRIMARY KEY,  -- UUID string
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,  -- e.g., 'Open-Meteo', 'Meteoblue'
  url TEXT,
  provider_type TEXT,  -- 'api', 'scraper', 'feed'
  is_active BOOLEAN DEFAULT 1,  -- 1=true, 0=false
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_weather_sources_code ON weather_sources(code);
CREATE INDEX IF NOT EXISTS idx_weather_sources_active ON weather_sources(is_active);

-- Table: weather_forecasts (Current + forecasted conditions)
CREATE TABLE IF NOT EXISTS weather_forecasts (
  id TEXT PRIMARY KEY,  -- UUID string
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES weather_sources(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,  -- Date of the forecast
  forecast_time TIME,  -- Time slot (hourly, 3h, daily)
  -- Core meteorological data
  temperature_c REAL,
  feels_like_c REAL,
  humidity_percent INTEGER,
  wind_speed_kmh REAL,
  wind_direction_deg INTEGER,  -- 0-360
  wind_gust_kmh REAL,
  pressure_hpa REAL,
  precipitation_mm REAL,
  precipitation_probability INTEGER,  -- 0-100
  cloud_cover_percent INTEGER,  -- 0-100
  visibility_km REAL,
  uv_index REAL,
  -- Paragliding-specific indices
  thermal_strength INTEGER,  -- 0-5 scale
  thermal_potential TEXT,  -- 'weak', 'moderate', 'strong'
  stability_index REAL,  -- Larger index = more stable
  -- Composite scoring
  para_index INTEGER DEFAULT 50,  -- 0-100 flying score
  verdict TEXT,  -- 'BON', 'MOYEN', 'LIMITE', 'MAUVAIS'
  verdict_reason TEXT,
  -- Metadata
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_weather_forecasts_site_id ON weather_forecasts(site_id);
CREATE INDEX IF NOT EXISTS idx_weather_forecasts_source_id ON weather_forecasts(source_id);
CREATE INDEX IF NOT EXISTS idx_weather_forecasts_date ON weather_forecasts(forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_weather_forecasts_site_date ON weather_forecasts(site_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_weather_forecasts_para_index ON weather_forecasts(para_index DESC);

-- =============================================================================
-- 3. ALERTS
-- =============================================================================

-- Table: alerts (User-defined alert rules)
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,  -- UUID string
  site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
  user_id TEXT DEFAULT 'vincent',  -- For future multi-user support
  name TEXT NOT NULL,  -- e.g., "Wind too high", "Perfect conditions"
  condition_type TEXT NOT NULL,  -- 'wind', 'temp', 'stability', 'para_index'
  operator TEXT,  -- '>', '<', '==', 'between'
  threshold_min REAL,
  threshold_max REAL,
  is_active BOOLEAN DEFAULT 1,
  notify_via TEXT,  -- 'telegram', 'email', 'both'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_site_id ON alerts(site_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active);

-- Table: alert_triggers (History of triggered alerts)
CREATE TABLE IF NOT EXISTS alert_triggers (
  id TEXT PRIMARY KEY,  -- UUID string
  alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  weather_forecast_id TEXT REFERENCES weather_forecasts(id),
  triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notified_at DATETIME,
  notification_method TEXT,  -- 'telegram', 'email'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_triggers_alert_id ON alert_triggers(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_triggered_at ON alert_triggers(triggered_at DESC);

-- =============================================================================
-- 4. LEARNING & ANALYTICS
-- =============================================================================

-- Table: flight_statistics (Aggregated stats per site/period)
CREATE TABLE IF NOT EXISTS flight_statistics (
  id TEXT PRIMARY KEY,  -- UUID string
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_flights INTEGER DEFAULT 0,
  total_duration_hours REAL DEFAULT 0,
  avg_duration_minutes REAL,
  avg_altitude_gain_m REAL,
  max_altitude_ever_m INTEGER,
  best_flight_duration_minutes INTEGER,
  -- Weather correlation
  avg_wind_speed_kmh REAL,
  ideal_wind_min REAL,
  ideal_wind_max REAL,
  -- Learning insights
  skill_level TEXT,  -- 'beginner', 'intermediate', 'advanced'
  improvement_trend REAL,  -- 0-1, percent improvement
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flight_statistics_site_id ON flight_statistics(site_id);
CREATE INDEX IF NOT EXISTS idx_flight_statistics_period ON flight_statistics(period_start, period_end);

-- =============================================================================
-- 5. DATA QUALITY & MONITORING
-- =============================================================================

-- Table: scraper_health (Tracking data source health)
CREATE TABLE IF NOT EXISTS scraper_health (
  id TEXT PRIMARY KEY,  -- UUID string
  source_id TEXT NOT NULL REFERENCES weather_sources(id) ON DELETE CASCADE,
  last_fetch_at DATETIME,
  last_success_at DATETIME,
  last_error_message TEXT,
  consecutive_errors INTEGER DEFAULT 0,
  error_rate_percent REAL DEFAULT 0,
  status TEXT,  -- 'healthy', 'warning', 'error'
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scraper_health_source_id ON scraper_health(source_id);
CREATE INDEX IF NOT EXISTS idx_scraper_health_status ON scraper_health(status);

-- Table: data_quality_logs (Track data validation)
CREATE TABLE IF NOT EXISTS data_quality_logs (
  id TEXT PRIMARY KEY,  -- UUID string
  source_id TEXT REFERENCES weather_sources(id),
  validation_type TEXT,  -- 'temperature_range', 'wind_consistency', etc.
  is_valid BOOLEAN,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_quality_logs_source ON data_quality_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_data_quality_logs_valid ON data_quality_logs(is_valid);

-- =============================================================================
-- 6. INITIAL DATA
-- =============================================================================

-- Insert weather sources
INSERT OR IGNORE INTO weather_sources (id, code, name, provider_type, description) VALUES
('src-001', 'open-meteo', 'Open-Meteo', 'api', 'Free weather API - open-meteo.com'),
('src-002', 'weatherapi', 'WeatherAPI', 'api', 'Weather API - weatherapi.com'),
('src-003', 'meteoblue', 'Meteoblue', 'scraper', 'Meteoblue forecast scraping'),
('src-004', 'meteo-parapente', 'Météo-parapente', 'feed', 'Météo-parapente RSS feed'),
('src-005', 'meteorueil', 'Météociel', 'scraper', 'Météociel forecast scraping'),
('src-006', 'parapente-net', 'Parapente.net', 'scraper', 'Parapente.net weather'),
('src-007', 'windy', 'Windy', 'api', 'Windy forecast API'),
('src-008', 'planete-voile', 'Planete-voile', 'scraper', 'Planete-voile forecast scraping');

-- Insert flying sites
INSERT OR IGNORE INTO sites (id, code, name, elevation_m, latitude, longitude, region, description) VALUES
('site-001', 'arguel', 'Arguel', 427, 47.22356, 6.01842, 'Besançon', 'Popular thermaling site, 427m'),
('site-002', 'mont-poupet', 'Mont Poupet', 842, 47.16425, 5.99234, 'Besançon', 'High altitude site, windy, 842m'),
('site-003', 'la-cote', 'La Côte', 800, 47.18956, 6.04567, 'Besançon', 'Ridge site, afternoon thermal activity, 800m');

-- =============================================================================
-- 7. VIEWS & HELPERS (for common queries)
-- =============================================================================

-- View: latest_conditions (Most recent conditions per site)
CREATE VIEW IF NOT EXISTS latest_conditions AS
SELECT 
  s.id,
  s.name,
  s.elevation_m,
  wf.source_id,
  ws.name AS source_name,
  wf.forecast_date,
  wf.forecast_time,
  wf.temperature_c,
  wf.wind_speed_kmh,
  wf.para_index,
  wf.verdict,
  wf.fetched_at
FROM weather_forecasts wf
JOIN sites s ON wf.site_id = s.id
JOIN weather_sources ws ON wf.source_id = ws.id
WHERE wf.fetched_at = (
  SELECT MAX(fetched_at) 
  FROM weather_forecasts 
  WHERE site_id = s.id AND source_id = ws.id
);

-- View: best_flying_days (Next 7 days ranked by para-index)
CREATE VIEW IF NOT EXISTS best_flying_days AS
SELECT 
  s.name,
  wf.forecast_date,
  AVG(wf.para_index) AS avg_para_index,
  MAX(wf.wind_speed_kmh) AS max_wind,
  MIN(wf.temperature_c) AS min_temp,
  MAX(wf.temperature_c) AS max_temp,
  COUNT(DISTINCT wf.source_id) AS sources_count
FROM weather_forecasts wf
JOIN sites s ON wf.site_id = s.id
WHERE wf.forecast_date >= DATE('now')
  AND wf.forecast_date <= DATE('now', '+7 days')
GROUP BY s.id, wf.forecast_date
ORDER BY wf.forecast_date, avg_para_index DESC;

-- View: flight_history_summary (Recent flights with weather context)
CREATE VIEW IF NOT EXISTS flight_history_summary AS
SELECT 
  f.id,
  f.title,
  f.flight_date,
  f.duration_minutes,
  f.max_altitude_m,
  f.distance_km,
  s.name AS site_name,
  s.elevation_m,
  f.created_at
FROM flights f
LEFT JOIN sites s ON f.site_id = s.id
ORDER BY f.flight_date DESC;

-- =============================================================================
-- NOTES FOR VINCENT
-- =============================================================================
-- SQLite database file location:
-- /home/capic/.openclaw/workspace/paragliding/db/dashboard.db
--
-- How to initialize:
-- sqlite3 /home/capic/.openclaw/workspace/paragliding/db/dashboard.db < dashboard-schema-sqlite.sql
--
-- Python connection string:
-- DATABASE_URL = "sqlite:///path/to/dashboard.db"
-- Or: sqlite+aiosqlite for async
--
-- Benefits of SQLite:
-- ✓ Zero infrastructure (no server)
-- ✓ Single file (easy backups)
-- ✓ Fast for single-user queries
-- ✓ Python built-in support (no extra deps)
--
-- Migration to PostgreSQL later:
-- Just change DATABASE_URL and schema (SQLAlchemy ORM handles it)
-- =============================================================================
