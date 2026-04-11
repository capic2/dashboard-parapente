-- Add refresh mode tracking for Strava token logs
ALTER TABLE strava_token_logs ADD COLUMN refresh_mode TEXT;
