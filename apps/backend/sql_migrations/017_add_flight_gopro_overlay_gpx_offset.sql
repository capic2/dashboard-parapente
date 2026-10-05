-- Keep the last validated GPX/video synchronization offset for each flight.
ALTER TABLE flights ADD COLUMN gopro_overlay_gpx_offset FLOAT NOT NULL DEFAULT 0.0;
