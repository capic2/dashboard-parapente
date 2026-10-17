ALTER TABLE video_export_jobs ADD COLUMN youtube_upload_job_id VARCHAR;
ALTER TABLE youtube_upload_jobs ADD COLUMN source_path VARCHAR;

CREATE UNIQUE INDEX IF NOT EXISTS uq_youtube_upload_jobs_preparing_or_active_flight
ON youtube_upload_jobs (flight_id)
WHERE status IN ('preparing', 'queued', 'uploading');
