ALTER TABLE flights ADD COLUMN gpx_source_file_path VARCHAR;
UPDATE flights
SET gpx_source_file_path = gpx_file_path
WHERE gpx_file_path IS NOT NULL AND gpx_source_file_path IS NULL;
