-- Migration 003: Add site landing associations table
-- Allows linking multiple landing sites to a takeoff site

CREATE TABLE IF NOT EXISTS site_landing_associations (
    id VARCHAR NOT NULL PRIMARY KEY,
    takeoff_site_id VARCHAR NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    landing_site_id VARCHAR NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT 0,
    distance_km FLOAT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(takeoff_site_id, landing_site_id)
);

CREATE INDEX IF NOT EXISTS idx_sla_takeoff ON site_landing_associations(takeoff_site_id);
CREATE INDEX IF NOT EXISTS idx_sla_landing ON site_landing_associations(landing_site_id);
