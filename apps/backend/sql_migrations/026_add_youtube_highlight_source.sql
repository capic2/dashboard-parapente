ALTER TABLE youtube_upload_jobs ADD COLUMN highlight_video_job_id VARCHAR;

CREATE INDEX IF NOT EXISTS idx_youtube_upload_jobs_highlight_video_job_id
    ON youtube_upload_jobs(highlight_video_job_id);
