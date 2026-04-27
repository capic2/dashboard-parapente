-- Persist manual export auth token across worker restarts/processes.
ALTER TABLE video_export_jobs ADD COLUMN auth_token TEXT;
