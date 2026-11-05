ALTER TABLE flights
ADD COLUMN landing_site_id VARCHAR REFERENCES sites(id);
