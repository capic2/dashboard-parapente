-- Generic external activity identity. Legacy Strava IDs remain persisted for compatibility.
ALTER TABLE flights ADD COLUMN external_provider VARCHAR;
ALTER TABLE flights ADD COLUMN external_activity_id VARCHAR;
UPDATE flights
SET external_provider = 'strava', external_activity_id = strava_id
WHERE strava_id IS NOT NULL
  AND (external_provider IS NULL OR external_activity_id IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_flights_external_activity
ON flights (external_provider, external_activity_id)
WHERE external_provider IS NOT NULL AND external_activity_id IS NOT NULL;
