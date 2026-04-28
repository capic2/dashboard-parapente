ALTER TABLE sites ADD COLUMN camera_close_zoom_percent INTEGER DEFAULT 75;
ALTER TABLE sites ADD COLUMN camera_transition_percent INTEGER DEFAULT 12;

UPDATE sites
SET camera_close_zoom_percent = 75
WHERE camera_close_zoom_percent IS NULL;

UPDATE sites
SET camera_transition_percent = 12
WHERE camera_transition_percent IS NULL;
