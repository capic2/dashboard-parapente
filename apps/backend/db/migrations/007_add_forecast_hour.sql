-- Migration 007: Add forecast_hour column to emagram_analysis table
-- Enables hour-by-hour emagram analysis (one record per hour per site per day)
ALTER TABLE emagram_analysis ADD COLUMN forecast_hour INTEGER;

CREATE INDEX IF NOT EXISTS idx_emagram_forecast_hour ON emagram_analysis (station_code, forecast_date, forecast_hour);
