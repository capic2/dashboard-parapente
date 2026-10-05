-- Associate every durable GoPro overlay job with its flight.
ALTER TABLE gopro_overlay_jobs ADD COLUMN flight_id VARCHAR;

-- Preserve the overlay already referenced by each existing flight.
UPDATE gopro_overlay_jobs
SET flight_id = (
    SELECT flights.id
    FROM flights
    WHERE flights.gopro_overlay_job_id = gopro_overlay_jobs.id
)
WHERE flight_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_gopro_overlay_jobs_flight_id
ON gopro_overlay_jobs (flight_id);
