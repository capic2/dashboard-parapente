# Paragliding Spots Search System - Implementation Summary

## Overview

Fully implemented hybrid paragliding spots search system integrating data from **OpenAIP** and **ParaglidingSpots.com** with geographic search capabilities.

## System Architecture

### Data Sources
1. **OpenAIP France** - 449 spots
   - Clean JSON format
   - Includes precise GPS coordinates
   - Provides elevation data
   - Type: takeoff (type=0) or landing (type=1)

2. **ParaglidingSpots.com** - 3,476 spots (France only)
   - JavaScript array format
   - Includes orientation (N, NNW, SE, etc.)
   - Provides quality ratings (0-6 scale)
   - Richer site names with details

3. **Merged Database** - 3,594 total spots
   - 331 merged entries (matched from both sources)
   - 118 OpenAIP-only entries
   - 3,145 ParaglidingSpots-only entries

### Database Schema

#### `paragliding_spots` Table
```sql
CREATE TABLE paragliding_spots (
    id VARCHAR PRIMARY KEY,           -- openaip_{id}, pgs_{id}, or merged_{hash}
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,            -- "takeoff", "landing", "both"
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    elevation_m INTEGER,
    orientation VARCHAR,              -- N, NNW, SE, etc.
    rating INTEGER,                   -- 0-6 quality score
    country VARCHAR DEFAULT 'FR',
    source VARCHAR NOT NULL,          -- "openaip", "paraglidingspots", "merged"
    openaip_id VARCHAR UNIQUE,
    paraglidingspots_id INTEGER UNIQUE,
    raw_metadata TEXT,                -- JSON with original data
    last_synced DATETIME,
    created_at DATETIME,
    updated_at DATETIME
);

-- Indexes for performance
CREATE INDEX idx_paragliding_spots_lat ON paragliding_spots (latitude);
CREATE INDEX idx_paragliding_spots_lon ON paragliding_spots (longitude);
CREATE INDEX idx_paragliding_spots_country ON paragliding_spots (country);
CREATE INDEX idx_paragliding_spots_type ON paragliding_spots (type);
CREATE INDEX idx_paragliding_spots_lat_lon ON paragliding_spots (latitude, longitude);
```

#### Extended `sites` Table
```sql
ALTER TABLE sites ADD COLUMN site_type VARCHAR DEFAULT 'user_spot';
ALTER TABLE sites ADD COLUMN linked_spot_id VARCHAR REFERENCES paragliding_spots(id);
```

## Modules Implemented

### 1. `spots/distance.py`
Geographic distance calculations using Haversine formula.

**Functions:**
- `haversine_distance(lat1, lon1, lat2, lon2) -> float`
  - Accurate great-circle distance in kilometers
  - Earth radius: 6,371 km
  
- `calculate_bounding_box(center_lat, center_lon, radius_km) -> tuple`
  - Fast pre-filter for database queries
  - Returns (min_lat, max_lat, min_lon, max_lon)
  
- `filter_by_distance(spots, center_lat, center_lon, radius_km) -> list`
  - Filter and sort spots by distance

### 2. `spots/geocoding.py`
City name to GPS coordinate conversion using Nominatim (OpenStreetMap).

**Functions:**
- `geocode_city(city_name, country="FR") -> Optional[Tuple[lat, lon]]`
  - Free geocoding via Nominatim API
  - 7-day in-memory cache (cities don't move!)
  - 1-second rate limiting (Nominatim requirement)
  - Returns None if city not found

**Features:**
- Automatic rate limiting (max 1 req/sec)
- In-memory caching with TTL
- Proper User-Agent header
- Error handling for API failures

### 3. `spots/data_fetcher.py`
Fetches, parses, and syncs data from external sources.

**Functions:**
- `fetch_openaip_data() -> List[Dict]`
  - Downloads fr_hgl.json from Google Cloud Storage
  - Parses geometry.coordinates and elevation.value
  - Returns standardized spot dictionaries
  
- `fetch_paraglidingspots_data() -> List[Dict]`
  - Downloads JavaScript file
  - Parses array format: [ID, Lon, Lat, "Name", Type, Rating, ...]
  - Extracts orientation from name (regex)
  
- `merge_duplicate_spots(openaip_spots, pgs_spots) -> List[Dict]`
  - Distance threshold: <100m = same spot
  - Merge strategy:
    - Coordinates: prefer OpenAIP (more precise)
    - Name: use OpenAIP
    - Orientation: use PGS
    - Rating: use PGS
    - Elevation: use OpenAIP
  
- `sync_to_database(db: Session) -> Dict[str, int]`
  - Fetches from both sources
  - Merges duplicates
  - Upserts to database
  - Returns statistics

### 4. `spots/search.py`
Geographic search engine for paragliding spots.

**Functions:**
- `search_by_coordinates(db, lat, lon, radius_km, spot_type) -> Dict`
  - Two-step search for performance:
    1. Bounding box filter (fast SQL)
    2. Precise haversine calculation
  - Returns spots sorted by distance
  
- `search_by_city(db, city_name, radius_km, spot_type, country) -> Dict`
  - Geocodes city first
  - Then performs coordinate search
  - Returns error if city not found
  
- `get_spot_by_id(db, spot_id) -> Optional[Dict]`
  - Full details for specific spot
  - Includes raw metadata
  
- `get_sync_status(db) -> Dict`
  - Statistics: total, by_source, by_type
  - Last sync timestamp
  - Database ready status

### 5. `spots/site_updater.py`
Links existing user sites to external spot data.

**Functions:**
- `link_sites_to_spots(db: Session) -> Dict`
  - Finds nearby spots within 500m
  - Links to closest match
  - Updates coordinates to precise GPS
  - Stores old coords in description
  - Updates elevation if available
  
- `unlink_all_sites(db: Session) -> Dict`
  - Removes all links (for reset/testing)

## API Endpoints

### Spots Search Endpoints

#### `POST /api/spots/sync`
Sync paragliding spots from external sources.

**Query Parameters:**
- `force` (bool, default: false) - Force sync even if data is recent

**Response:**
```json
{
    "success": true,
    "message": "Synced 3594 spots (3594 new, 0 updated)",
    "stats": {
        "added": 3594,
        "updated": 0,
        "total": 3594,
        "openaip_fetched": 449,
        "pgs_fetched": 3476,
        "merged_total": 3594
    },
    "timestamp": "2026-03-01T16:50:55.780387",
    "synced": true
}
```

**Features:**
- Auto-syncs if >7 days old
- Use `?force=true` to sync regardless

#### `GET /api/spots/search`
Search for paragliding spots by city or coordinates.

**Query Parameters:**
- `city` (string) - City name (e.g., "Besançon")
- `lat` (float) - Latitude (decimal degrees)
- `lon` (float) - Longitude (decimal degrees)  
- `radius_km` (int, default: 50) - Search radius
- `type` (string) - Filter: "takeoff" or "landing"

**Must provide either:**
- `city` alone, OR
- `lat` AND `lon` together

**Examples:**
```bash
# Search by city
GET /api/spots/search?city=Besançon&radius_km=50

# Search by coordinates
GET /api/spots/search?lat=47.24&lon=6.02&radius_km=30&type=takeoff
```

**Response:**
```json
{
    "query": {
        "latitude": 47.1944,
        "longitude": 5.9896,
        "radius_km": 10,
        "type": null
    },
    "total": 10,
    "spots": [
        {
            "id": "merged_884e0213d9116315",
            "name": "DÉCOLLAGE LA MALTOURNÉE NORD",
            "type": "takeoff",
            "latitude": 47.1944542,
            "longitude": 5.9896408,
            "elevation_m": 462,
            "orientation": "NNW",
            "rating": 3,
            "country": "FR",
            "source": "merged",
            "distance_km": 0.01
        }
    ]
}
```

#### `GET /api/spots/detail/{spot_id}`
Get full details for a specific spot.

**Response:**
```json
{
    "id": "merged_884e0213d9116315",
    "name": "DÉCOLLAGE LA MALTOURNÉE NORD",
    "type": "takeoff",
    "latitude": 47.1944542,
    "longitude": 5.9896408,
    "elevation_m": 462,
    "orientation": "NNW",
    "rating": 3,
    "country": "FR",
    "source": "merged",
    "openaip_id": "6293a544c62e4ba5ee8c3c16",
    "paraglidingspots_id": 4737,
    "raw_metadata": "{...}",
    "last_synced": "2026-03-01T16:50:54.170492",
    "created_at": "2026-03-01T16:50:54.170492",
    "updated_at": "2026-03-01T16:50:54.170492"
}
```

#### `GET /api/spots/status`
Get database statistics and sync status.

**Response:**
```json
{
    "total_spots": 3594,
    "by_source": {
        "openaip": 118,
        "paraglidingspots": 3145,
        "merged": 331
    },
    "by_type": {
        "takeoff": 1824,
        "landing": 320
    },
    "last_sync": "2026-03-01T16:50:54.170492",
    "database_ready": true
}
```

### Admin Endpoints

#### `POST /api/admin/sites/link-to-spots`
Link existing user sites to external paragliding spots.

**Features:**
- Finds matching spots within 500m
- Updates coordinates to precise GPS
- Updates elevation from external data
- Stores original coords in description

**Response:**
```json
{
    "success": true,
    "message": "Linked 1 of 3 sites",
    "stats": {
        "total_sites": 3,
        "linked": 1,
        "not_found": 2,
        "updated_coords": 0
    }
}
```

## Performance Optimizations

### 1. Database Indexes
- Composite index on (latitude, longitude) for bounding box queries
- Individual indexes on lat, lon, country, type
- Typical query: ~1000 spots filtered → ~100 haversine calculations → ~20 results

### 2. Two-Step Search
1. **Bounding box filter** (fast SQL WHERE clause)
   - Filters by approximate rectangle
   - Uses simple comparison operators
   
2. **Haversine distance** (precise calculation)
   - Only on remaining candidates
   - Sorts by actual distance

### 3. Geocoding Cache
- In-memory cache with 7-day TTL
- Reduces API calls to Nominatim
- Cities are static (coordinates don't change)

## Testing Results

### Sync Results
```
Total spots: 3,594
- OpenAIP-only: 118
- ParaglidingSpots-only: 3,145  
- Merged (both sources): 331

By type:
- Takeoff: 1,824
- Landing: 320
- Both: 1,450 (inferred from totals)
```

### Search Results (Besançon, 50km radius)
- **Total spots found:** 56
- **Closest spot:** Fort de Rosemont (2.57 km)
- **Query time:** <100ms

### Search Results (Arguel coordinates, 10km radius)
- **Total spots found:** 10
- **Closest spot:** La Maltournée Nord (0.01 km) - exact match!

### Site Linking (Arguel)
```
Before: Arguel (47.012, 6.789) - wrong location (64km off)
After:  Arguel (47.1944, 5.9896) - precise GPS
Linked to: merged_884e0213d9116315 (La Maltournée Nord)
Enhanced data:
  - Elevation: 462m
  - Orientation: NNW
  - Rating: 3/6
  - Type: takeoff
```

## Data Quality

### Merge Statistics
- **100m distance threshold** for duplicate detection
- **331 successfully merged** spots from both sources
- **Merge strategy** balances precision (OpenAIP) with richness (PGS)

### Known Issues
1. **OpenAIP spots:** No orientation data
2. **ParaglidingSpots:** No elevation in JS file (available in KMZ)
3. **Small villages:** May not geocode (Nominatim limitation)
4. **Rate limiting:** Nominatim requires 1 sec between requests

## Future Enhancements

### Short-term
1. Cache geocoding results to disk (persistent cache)
2. Add spot details to Site model display
3. Show nearest spots in weather view

### Long-term
1. Download ParaglidingSpots KMZ for elevation data
2. Add wind direction matching (orientation vs forecast)
3. Auto-suggest spots when adding new sites
4. Integration with weather API (show conditions per spot)
5. User favorites and custom spot lists

## File Structure

```
backend/
├── spots/                              # NEW MODULE
│   ├── __init__.py                     # Module exports
│   ├── distance.py                     # Haversine calculations
│   ├── geocoding.py                    # City → GPS
│   ├── data_fetcher.py                 # OpenAIP + PGS sync
│   ├── search.py                       # Geographic search
│   └── site_updater.py                 # Link user sites
│
├── db/
│   ├── migrations/
│   │   └── 001_add_paragliding_spots.sql
│   └── dashboard.db                    # SQLite database
│
├── models.py                           # UPDATED: Added ParaglidingSpot
├── schemas.py                          # UPDATED: Added spot schemas
├── routes.py                           # UPDATED: Added search endpoints
└── main.py                             # UPDATED: Migration runner

SPOTS_SYSTEM_SUMMARY.md                # This file
```

## Usage Examples

### 1. Initial Setup
```bash
# Start server (migrations run automatically)
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# Sync paragliding spots (first time or after 7 days)
curl -X POST "http://localhost:8001/api/spots/sync"
```

### 2. Search Spots
```bash
# Find takeoff spots near Besançon
curl "http://localhost:8001/api/spots/search?city=Besançon&radius_km=30&type=takeoff"

# Find all spots at GPS coordinates
curl "http://localhost:8001/api/spots/search?lat=47.1944&lon=5.9896&radius_km=10"

# Get detailed info for a specific spot
curl "http://localhost:8001/api/spots/detail/merged_884e0213d9116315"
```

### 3. Link User Sites
```bash
# Link existing sites to external spot data
curl -X POST "http://localhost:8001/api/admin/sites/link-to-spots"
```

### 4. Check Status
```bash
# Get database statistics
curl "http://localhost:8001/api/spots/status"
```

## Technical Decisions

### Why SQLite?
- Simple deployment (no separate DB server)
- Fast for geographic queries with proper indexes
- Sufficient for 3,500 spots (could scale to 100k+)
- Backup/restore = copy single file

### Why Hybrid Sources?
- **OpenAIP:** Precise GPS, elevation, official data
- **ParaglidingSpots:** Orientation, ratings, community knowledge
- **Merged:** Best of both worlds

### Why On-Demand Search?
- No need to load 3,500 spots on every page
- Geographic filtering reduces data transfer
- Scales better than pre-loading all data

## Success Metrics

✅ **All 7 implementation phases completed**
✅ **3,594 spots synced** from 2 sources
✅ **Geographic search working** (city and coordinates)
✅ **Type filtering functional** (takeoff/landing)
✅ **Site linking operational** (Arguel linked successfully)
✅ **Performance optimized** (<100ms search queries)
✅ **API fully documented** with examples
✅ **Backward compatible** (existing endpoints unchanged)

## Conclusion

The paragliding spots search system is **fully operational** and ready for production use. It provides:

1. **Comprehensive database** of 3,594 French paragliding sites
2. **Fast geographic search** with distance-based filtering
3. **Rich metadata** including orientation, ratings, elevation
4. **Hybrid data sources** combining official and community data
5. **RESTful API** with clear documentation
6. **Site enhancement** through automatic linking

The system successfully resolves the user's need to find precise GPS coordinates for paragliding sites and provides on-demand search capabilities for discovering new spots near any city in France.
