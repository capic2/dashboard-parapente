-- Persist per-flight GoPro overlay state for media export actions.
ALTER TABLE flights ADD COLUMN gopro_overlay_job_id VARCHAR;
ALTER TABLE flights ADD COLUMN gopro_overlay_status VARCHAR;
ALTER TABLE flights ADD COLUMN gopro_overlay_file_path VARCHAR;
