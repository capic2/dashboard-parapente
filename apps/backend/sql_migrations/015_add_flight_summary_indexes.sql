-- Cover the default keyset order, both globally and within a site filter.
CREATE INDEX IF NOT EXISTS idx_flights_summary_default
ON flights (flight_date DESC, departure_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_flights_summary_site_default
ON flights (site_id, flight_date DESC, departure_time DESC, id DESC);
