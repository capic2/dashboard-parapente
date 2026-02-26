-- =============================================================================
-- DASHBOARD PARAPENTE - Schema PostgreSQL
-- =============================================================================
-- Generated: 2026-02-26
-- For: Vincent's Personal Paragliding Dashboard
-- Database: parapente_dashboard
-- Version: 1.0 (Design Phase)
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search on locations
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- For range queries

-- =============================================================================
-- 1. CORE ENTITIES - Vols et Lieux
-- =============================================================================

-- Table: sites (Flying spots)
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'arguel', 'mont-poupet'
  name VARCHAR(255) NOT NULL,
  elevation_m INT NOT NULL,  -- Elevation in meters
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  description TEXT,
  region VARCHAR(100),  -- e.g., 'Bourgogne-Franche-Comté'
  country VARCHAR(2) DEFAULT 'FR',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sites_code ON sites(code);
CREATE INDEX idx_sites_region ON sites(region);
CREATE INDEX idx_sites_location ON sites USING GIST (ll_to_earth(latitude, longitude));

-- Table: flights (Vols - synchronized from Strava)
CREATE TABLE flights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strava_id VARCHAR(255) UNIQUE,  -- External Strava flight ID
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  title VARCHAR(500),
  description TEXT,
  flight_date DATE NOT NULL,
  duration_minutes INT,
  max_altitude_m INT,
  max_speed_kmh DECIMAL(5, 2),
  distance_km DECIMAL(8, 2),
  elevation_gain_m INT,
  notes TEXT,
  external_url VARCHAR(500),  -- Link to Strava activity
  -- Metadata
  imported_from VARCHAR(50) DEFAULT 'strava',
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flights_site_id ON flights(site_id);
CREATE INDEX idx_flights_flight_date ON flights(flight_date DESC);
CREATE INDEX idx_flights_strava_id ON flights(strava_id);

-- =============================================================================
-- 2. WEATHER DATA - 8 Sources multimédia
-- =============================================================================

-- Table: weather_sources (Available weather data providers)
CREATE TABLE weather_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,  -- e.g., 'Open-Meteo', 'Meteoblue'
  url VARCHAR(500),
  provider_type VARCHAR(50),  -- 'api', 'scraper', 'feed'
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weather_sources_code ON weather_sources(code);
CREATE INDEX idx_weather_sources_active ON weather_sources(is_active);

-- Table: weather_forecasts (Current + forecasted conditions)
CREATE TABLE weather_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES weather_sources(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,  -- Date of the forecast
  forecast_time TIME,  -- Time slot (hourly, 3h, daily)
  -- Core meteorological data
  temperature_c DECIMAL(5, 2),
  feels_like_c DECIMAL(5, 2),
  humidity_percent INT,
  wind_speed_kmh DECIMAL(6, 2),
  wind_direction_deg INT,  -- 0-360
  wind_gust_kmh DECIMAL(6, 2),
  pressure_hpa DECIMAL(7, 2),
  precipitation_mm DECIMAL(6, 2),
  precipitation_probability INT,  -- 0-100
  cloud_cover_percent INT,  -- 0-100
  visibility_km DECIMAL(5, 2),
  uv_index DECIMAL(3, 1),
  -- Parapente-specific indicators
  thermal_index DECIMAL(3, 1),  -- Estimated thermal strength (1-10)
  stability_index DECIMAL(3, 1),  -- Atmospheric stability (1-10)
  para_index INT,  -- Composite flying condition score (0-100)
  -- Metadata
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weather_forecasts_site_date ON weather_forecasts(site_id, forecast_date DESC);
CREATE INDEX idx_weather_forecasts_source ON weather_forecasts(source_id);
CREATE INDEX idx_weather_forecasts_timestamp ON weather_forecasts(created_at DESC);
CREATE INDEX idx_weather_forecasts_para_index ON weather_forecasts(para_index DESC);

-- Table: weather_history (Archive of historical weather for analysis)
CREATE TABLE weather_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES weather_sources(id) ON DELETE CASCADE,
  observation_date DATE NOT NULL,
  observation_time TIME,
  -- Same meteorological fields as forecasts
  temperature_c DECIMAL(5, 2),
  wind_speed_kmh DECIMAL(6, 2),
  wind_direction_deg INT,
  precipitation_mm DECIMAL(6, 2),
  cloud_cover_percent INT,
  -- Status at flight time
  was_flyable BOOLEAN,  -- Could you fly at this time?
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weather_history_site_date ON weather_history(site_id, observation_date DESC);
CREATE INDEX idx_weather_history_was_flyable ON weather_history(was_flyable);

-- =============================================================================
-- 3. DASHBOARD CONFIGURATION
-- =============================================================================

-- Table: user_preferences
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL UNIQUE,  -- e.g., 'vincent'
  -- Display preferences
  theme VARCHAR(50) DEFAULT 'light',  -- 'light', 'dark'
  preferred_units VARCHAR(50) DEFAULT 'metric',  -- 'metric', 'imperial'
  language VARCHAR(10) DEFAULT 'fr',
  -- Dashboard configuration
  default_site_id UUID REFERENCES sites(id),
  forecast_horizon_days INT DEFAULT 7,  -- Show 7-day forecast
  historical_days INT DEFAULT 30,  -- Show 30-day history
  refresh_interval_minutes INT DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: alert_rules (User-configured alerts)
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES user_preferences(user_id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  -- Trigger conditions
  condition_type VARCHAR(100),  -- 'wind_speed', 'temperature', 'para_index', 'rain'
  condition_operator VARCHAR(10),  -- '>', '<', '=', '>=', '<='
  condition_value DECIMAL(10, 2),
  -- Notification
  alert_method VARCHAR(50),  -- 'email', 'telegram', 'webhook'
  destination VARCHAR(500),  -- Email address, Telegram chat ID, webhook URL
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_rules_user_site ON alert_rules(user_id, site_id);
CREATE INDEX idx_alert_rules_active ON alert_rules(is_active);

-- Table: alert_history (Fired alerts for auditing)
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  forecast_id UUID REFERENCES weather_forecasts(id) ON DELETE SET NULL,
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  status VARCHAR(50),  -- 'pending', 'sent', 'failed'
  error_message TEXT
);

CREATE INDEX idx_alert_history_rule_date ON alert_history(alert_rule_id, triggered_at DESC);

-- =============================================================================
-- 4. LEARNING & STATISTICS
-- =============================================================================

-- Table: flight_stats (Aggregated user learning statistics)
CREATE TABLE flight_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  -- Aggregation period
  period_type VARCHAR(50),  -- 'daily', 'weekly', 'monthly', 'all_time'
  period_date DATE,  -- Start date of period
  -- Statistics
  total_flights INT DEFAULT 0,
  total_duration_hours DECIMAL(8, 2) DEFAULT 0,
  avg_flight_duration_minutes INT DEFAULT 0,
  max_altitude_m INT,
  max_speed_kmh DECIMAL(5, 2),
  total_distance_km DECIMAL(10, 2),
  avg_elevation_gain_m INT,
  -- Learning indicators
  is_improving BOOLEAN,  -- Trend analysis: improving?
  consistency_score INT,  -- 0-100: how regular is the user flying?
  skill_level VARCHAR(50),  -- 'beginner', 'intermediate', 'advanced'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flight_stats_user_period ON flight_stats(user_id, period_type, period_date DESC);

-- Table: weather_correlation (Link between flight conditions and actual outcomes)
CREATE TABLE weather_correlation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flight_id UUID NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  forecast_id UUID REFERENCES weather_forecasts(id) ON DELETE SET NULL,
  -- Comparison
  forecast_para_index INT,
  actual_para_index INT,  -- Calculated from flight stats
  accuracy_score DECIMAL(3, 1),  -- 0-100: how accurate was the forecast?
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weather_correlation_flight ON weather_correlation(flight_id);
CREATE INDEX idx_weather_correlation_accuracy ON weather_correlation(accuracy_score);

-- =============================================================================
-- 5. SCRAPING & DATA SYNC
-- =============================================================================

-- Table: scraping_jobs (Track scraping tasks)
CREATE TABLE scraping_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES weather_sources(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  job_type VARCHAR(100),  -- 'forecast', 'historical', 'alert'
  status VARCHAR(50),  -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  records_fetched INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_source_site ON scraping_jobs(source_id, site_id);
CREATE INDEX idx_scraping_jobs_created_at ON scraping_jobs(created_at DESC);

-- Table: scraping_config (Configuration for each source)
CREATE TABLE scraping_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL UNIQUE REFERENCES weather_sources(id) ON DELETE CASCADE,
  -- Scraping settings
  enabled BOOLEAN DEFAULT TRUE,
  url_template VARCHAR(500),  -- Templated URL for requests
  update_interval_minutes INT DEFAULT 60,  -- How often to fetch
  timeout_seconds INT DEFAULT 30,
  retry_count INT DEFAULT 3,
  retry_delay_seconds INT DEFAULT 10,
  -- Parsing hints
  parser_type VARCHAR(50),  -- 'json_api', 'html_selenium', 'html_beautifulsoup'
  data_mapping JSONB,  -- Field mapping (e.g., {"wind_speed": "vitesseVent"})
  -- Rate limiting
  rate_limit_requests INT,
  rate_limit_window_seconds INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: data_sync_log (Track all sync operations)
CREATE TABLE data_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES weather_sources(id) ON DELETE SET NULL,
  entity_type VARCHAR(100),  -- 'flights', 'weather_forecasts', etc.
  operation VARCHAR(50),  -- 'fetch', 'insert', 'update'
  records_processed INT,
  status VARCHAR(50),  -- 'success', 'partial', 'failed'
  error_log TEXT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_sync_log_source ON data_sync_log(source_id);
CREATE INDEX idx_data_sync_log_synced_at ON data_sync_log(synced_at DESC);

-- =============================================================================
-- 6. API & AUDIT
-- =============================================================================

-- Table: api_keys (For dashboard access & integrations)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_hash VARCHAR(255) UNIQUE NOT NULL,  -- SHA-256 hash
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  scopes VARCHAR(500),  -- 'read:forecast', 'write:alerts', etc.
  rate_limit_requests INT DEFAULT 1000,
  rate_limit_window_seconds INT DEFAULT 3600,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Table: audit_log (Track all significant operations)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255),
  action VARCHAR(100),  -- 'view_forecast', 'create_alert', 'sync_flights'
  resource_type VARCHAR(100),
  resource_id UUID,
  status VARCHAR(50),  -- 'success', 'failure'
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);

-- =============================================================================
-- 7. MIGRATIONS & VERSIONING
-- =============================================================================

-- Table: schema_versions (Track schema migrations)
CREATE TABLE schema_versions (
  id SERIAL PRIMARY KEY,
  version_number VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(500),
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rollback_script TEXT
);

-- =============================================================================
-- INITIAL DATA INSERTS
-- =============================================================================

-- Insert weather sources
INSERT INTO weather_sources (code, name, url, provider_type, is_active, description)
VALUES
  ('open-meteo', 'Open-Meteo', 'https://open-meteo.com', 'api', TRUE, 'Free weather API with historical data'),
  ('weatherapi', 'WeatherAPI', 'https://www.weatherapi.com', 'api', TRUE, 'Real-time weather data'),
  ('meteoblue', 'Meteoblue', 'https://www.meteoblue.com', 'scraper', TRUE, 'Professional weather with model comparison'),
  ('meteo-parapente', 'Météo-parapente', 'https://www.meteo-parapente.com', 'scraper', TRUE, 'Paragliding-specific weather forecasts'),
  ('meteociel', 'Météociel', 'https://www.meteociel.fr', 'scraper', TRUE, 'French meteorological data'),
  ('parapente-net', 'Parapente.net', 'https://www.parapente.net', 'scraper', FALSE, 'French paragliding portal (to implement)'),
  ('windy', 'Windy', 'https://www.windy.com', 'api', FALSE, 'Wind and weather visualization (API planned)'),
  ('planete-voile', 'Planète-Voile', 'https://www.planete-voile.com', 'scraper', FALSE, 'Sailing/wind conditions (to implement)');

-- Insert flying sites
INSERT INTO sites (code, name, elevation_m, latitude, longitude, region, country)
VALUES
  ('arguel', 'Arguel', 427, 47.2823, 6.1742, 'Bourgogne-Franche-Comté', 'FR'),
  ('mont-poupet', 'Mont Poupet', 842, 47.2247, 6.2045, 'Bourgogne-Franche-Comté', 'FR'),
  ('la-cote', 'La Côte', 800, 47.2567, 6.1856, 'Bourgogne-Franche-Comté', 'FR');

-- Insert default user preferences
INSERT INTO user_preferences (user_id, theme, language, preferred_units)
VALUES
  ('vincent', 'light', 'fr', 'metric');

-- =============================================================================
-- VIEWS FOR DASHBOARD
-- =============================================================================

-- View: Current conditions for all sites (latest from each source)
CREATE OR REPLACE VIEW v_current_conditions AS
SELECT
  s.id,
  s.code,
  s.name,
  s.elevation_m,
  ws.name as source_name,
  wf.temperature_c,
  wf.humidity_percent,
  wf.wind_speed_kmh,
  wf.wind_direction_deg,
  wf.wind_gust_kmh,
  wf.cloud_cover_percent,
  wf.para_index,
  wf.forecast_date,
  wf.fetched_at,
  ROW_NUMBER() OVER (PARTITION BY s.id, ws.id ORDER BY wf.created_at DESC) as rn
FROM sites s
LEFT JOIN weather_forecasts wf ON s.id = wf.site_id
LEFT JOIN weather_sources ws ON wf.source_id = ws.id
WHERE wf.forecast_date = CURRENT_DATE
ORDER BY s.code, wf.created_at DESC;

-- View: Flight summary for dashboard
CREATE OR REPLACE VIEW v_flight_summary AS
SELECT
  COUNT(*) as total_flights,
  COUNT(DISTINCT DATE(flight_date)) as flight_days,
  SUM(COALESCE(duration_minutes, 0)) as total_minutes,
  AVG(COALESCE(duration_minutes, 0))::INT as avg_duration_minutes,
  MAX(COALESCE(max_altitude_m, 0)) as max_altitude,
  MAX(COALESCE(max_speed_kmh, 0))::DECIMAL as max_speed,
  SUM(COALESCE(distance_km, 0))::DECIMAL(10, 2) as total_distance
FROM flights;

-- =============================================================================
-- TRIGGERS (Optional, for auto-update timestamps)
-- =============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sites_timestamp BEFORE UPDATE ON sites
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_flights_timestamp BEFORE UPDATE ON flights
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_user_preferences_timestamp BEFORE UPDATE ON user_preferences
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- =============================================================================
-- PERMISSIONS & SECURITY (Example for Vincent)
-- =============================================================================

-- Note: In production, create specific roles and grant permissions
-- For now, this is documented as a template:
--
-- CREATE ROLE dashboard_user LOGIN PASSWORD 'secure_password';
-- GRANT CONNECT ON DATABASE parapente_dashboard TO dashboard_user;
-- GRANT USAGE ON SCHEMA public TO dashboard_user;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboard_user;
-- GRANT INSERT, UPDATE ON flights, alert_rules TO dashboard_user;
-- GRANT SELECT ON weather_forecasts, weather_history TO dashboard_user;

-- =============================================================================
-- VERSION TRACKING
-- =============================================================================

INSERT INTO schema_versions (version_number, description)
VALUES ('1.0', 'Initial design - Phase 1 (design only)');

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
