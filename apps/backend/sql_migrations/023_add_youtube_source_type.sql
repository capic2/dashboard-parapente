ALTER TABLE youtube_upload_jobs
ADD COLUMN source_type VARCHAR(32) NOT NULL DEFAULT 'gopro_overlay';

CREATE INDEX IF NOT EXISTS idx_youtube_upload_jobs_source_type
ON youtube_upload_jobs (source_type);
