-- Migration 005: Add forecast_date column to emagram_analysis table
ALTER TABLE emagram_analysis ADD COLUMN forecast_date DATE;

UPDATE emagram_analysis SET forecast_date = analysis_date WHERE forecast_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_emagram_analysis_forecast_date ON emagram_analysis (forecast_date);
