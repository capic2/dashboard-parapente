-- Mark legacy default offsets as unset when no overlay configuration was saved.
ALTER TABLE flights ADD COLUMN gopro_overlay_gpx_offset_nullable FLOAT;

UPDATE flights
SET gopro_overlay_gpx_offset_nullable = CASE
    WHEN gopro_overlay_gpx_offset = 0
        AND gopro_overlay_job_id IS NULL
        AND gopro_overlay_status IS NULL
        AND gopro_overlay_file_path IS NULL
        AND NOT EXISTS (
            SELECT 1
            FROM gopro_overlay_jobs
            WHERE gopro_overlay_jobs.flight_id = flights.id
        )
    THEN NULL
    ELSE gopro_overlay_gpx_offset
END;

ALTER TABLE flights DROP COLUMN gopro_overlay_gpx_offset;
ALTER TABLE flights RENAME COLUMN gopro_overlay_gpx_offset_nullable TO gopro_overlay_gpx_offset;
