ALTER TABLE video_export_jobs ADD COLUMN eta_seconds INTEGER;
ALTER TABLE video_export_jobs ADD COLUMN frames_processed INTEGER;
ALTER TABLE video_export_jobs ADD COLUMN fps_actual FLOAT;
