-- Migration 001: Add paragliding spots table
-- Creates new table for external paragliding site data (OpenAIP + ParaglidingSpots)
-- Also updates existing sites table with linking capability

-- Create paragliding_spots table
CREATE TABLE IF NOT EXISTS paragliding_spots (
    id VARCHAR NOT NULL PRIMARY KEY,
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    elevation_m INTEGER,
    orientation VARCHAR,
    rating INTEGER,
    country VARCHAR DEFAULT 'FR',
    source VARCHAR NOT NULL,
    openaip_id VARCHAR UNIQUE,
    paraglidingspots_id INTEGER UNIQUE,
    raw_metadata TEXT,
    last_synced DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_paragliding_spots_lat ON paragliding_spots (latitude);
CREATE INDEX IF NOT EXISTS idx_paragliding_spots_lon ON paragliding_spots (longitude);
CREATE INDEX IF NOT EXISTS idx_paragliding_spots_country ON paragliding_spots (country);
CREATE INDEX IF NOT EXISTS idx_paragliding_spots_type ON paragliding_spots (type);
CREATE INDEX IF NOT EXISTS idx_paragliding_spots_lat_lon ON paragliding_spots (latitude, longitude);

-- Add new columns to sites table (backward compatible)
-- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check in Python code
-- ALTER TABLE sites ADD COLUMN site_type VARCHAR DEFAULT 'user_spot';
-- ALTER TABLE sites ADD COLUMN linked_spot_id VARCHAR REFERENCES paragliding_spots(id);

-- These will be added via Python to handle "column already exists" errors gracefully
