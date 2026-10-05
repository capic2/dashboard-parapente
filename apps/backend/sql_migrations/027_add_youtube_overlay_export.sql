ALTER TABLE video_export_jobs ADD COLUMN source_type VARCHAR(32);
ALTER TABLE video_export_jobs ADD COLUMN youtube_url TEXT;
ALTER TABLE video_export_jobs ADD COLUMN overlay_job_id VARCHAR;
ALTER TABLE video_export_jobs ADD COLUMN overlay_offset_seconds FLOAT;
