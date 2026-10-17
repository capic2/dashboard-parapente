DROP INDEX IF EXISTS uq_youtube_upload_jobs_active_flight;
DROP INDEX IF EXISTS uq_youtube_upload_jobs_preparing_or_active_flight;

ALTER TABLE youtube_upload_jobs ADD COLUMN active_source_key VARCHAR(256);

UPDATE youtube_upload_jobs
SET active_source_key = source_type || ':' ||
    COALESCE(gopro_overlay_job_id, '') || ':' ||
    COALESCE(highlight_video_job_id, '');

CREATE UNIQUE INDEX uq_youtube_upload_jobs_active_source
ON youtube_upload_jobs (flight_id, active_source_key)
WHERE active_source_key IS NOT NULL
  AND status IN ('preparing', 'queued', 'uploading');
