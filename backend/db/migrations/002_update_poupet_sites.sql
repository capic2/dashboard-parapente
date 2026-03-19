-- Migration 002: Update Mont Poupet and La Côte with precise coordinates
-- This migration fixes coordinate errors (~60-70km off) and adds Mont Poupet takeoff variants

-- Add new columns to sites table
ALTER TABLE sites ADD COLUMN rating INTEGER;
ALTER TABLE sites ADD COLUMN orientation TEXT;

-- Update Arguel with rating (coordinates already correct)
UPDATE sites 
SET rating = 3, orientation = 'NNW'
WHERE id = 'site-arguel';

-- Delete old incorrect Mont Poupet site
DELETE FROM sites WHERE id = 'site-mont-poupet';

-- Create 4 Mont Poupet takeoff sites with PRECISE coordinates from official database
-- All coordinates verified against paragliding_spots table (merged OpenAIP + ParaglidingSpots.com)

INSERT INTO sites (id, name, latitude, longitude, linked_spot_id, rating, orientation) VALUES
  -- Mont Poupet Nord: 46.9716, 5.8776 (was 47.015, 6.75 = 66.34km error)
  ('site-mont-poupet-nord', 'Mont Poupet Nord', 46.9716, 5.8776, 'merged_d370be468747c90a', 4, 'N'),
  
  -- Mont Poupet Nord-Ouest: 46.9701, 5.8742
  ('site-mont-poupet-nw', 'Mont Poupet Nord-Ouest', 46.9701, 5.8742, 'merged_c30c861b49a65324', 3, 'NW'),
  
  -- Mont Poupet Ouest: 46.9693, 5.8747
  ('site-mont-poupet-ouest', 'Mont Poupet Ouest', 46.9693, 5.8747, 'merged_359e1153c44c269e', 4, 'W'),
  
  -- Mont Poupet Sud: 46.9691, 5.8762
  ('site-mont-poupet-sud', 'Mont Poupet Sud', 46.9691, 5.8762, 'merged_60fbcc6724417e87', 1, 'S');

-- Update La Côte with PRECISE coordinates (was 47.02, 6.77 = 70.79km error)
UPDATE sites 
SET latitude = 46.9424, 
    longitude = 5.8438, 
    linked_spot_id = 'merged_d3836f8db6c839fa', 
    rating = 2,
    orientation = 'N'
WHERE id = 'site-la-cote';

-- Verification queries (for manual testing)
-- SELECT COUNT(*) FROM sites; -- Should be 6 sites total
-- SELECT id, name, latitude, longitude, rating, orientation FROM sites ORDER BY name;
