-- Migration 006: Add sources_errors column to emagram_analysis table
-- Stores per-source error details as JSON (e.g., {"meteo-parapente": "timeout after 30s"})
ALTER TABLE emagram_analysis ADD COLUMN sources_errors TEXT;
