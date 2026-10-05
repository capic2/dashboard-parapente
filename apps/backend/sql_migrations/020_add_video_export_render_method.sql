-- Persist the hardware method selected by the separate video export worker.
ALTER TABLE video_export_jobs ADD COLUMN render_method VARCHAR;
