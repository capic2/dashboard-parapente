ALTER TABLE youtube_upload_jobs
ADD COLUMN gopro_overlay_job_id VARCHAR;

UPDATE youtube_upload_jobs
SET status = 'cancelled',
    upload_session_encrypted = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE status IN ('queued', 'uploading')
  AND gopro_overlay_job_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_youtube_upload_jobs_gopro_overlay_job_id
ON youtube_upload_jobs (gopro_overlay_job_id);
