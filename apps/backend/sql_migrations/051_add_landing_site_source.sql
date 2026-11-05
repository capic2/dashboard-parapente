ALTER TABLE flights ADD COLUMN landing_site_source VARCHAR;
UPDATE flights
SET landing_site_source = 'manual'
WHERE landing_site_id IS NOT NULL AND landing_site_source IS NULL;
