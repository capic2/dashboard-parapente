# 🪂 GPX 3D Viewer - Cesium Integration

**Feature:** 3D flight visualization with Cesium, elevation profiles, and replay animation.

---

## Architecture

### Data Flow

```
Strava Webhook
  ├── Download GPX from Strava API
  ├── Parse GPX → Extract coordinates + elevations
  ├── Store locally: /workspace/paragliding/flights/gpx/strava_12345.gpx
  ├── Insert flight metadata in DB:
  │   - flights.gpx_file_path
  │   - flights.gpx_max_altitude_m
  │   - flights.gpx_elevation_gain_m
  │   - flights.notes (for user comments)
  └── Send Telegram: "Vol ajouté! [Add Notes] [View 3D]"

Frontend Dashboard
  ├── Display flight list (TanStack Table)
  ├── Click flight → Open FlightViewer3D component
  └── 3D Viewer shows:
      - Track on 3D terrain (Cesium)
      - Elevation profile (Chart.js)
      - Replay animation
      - Download GPX button
      - Edit notes form
```

---

## Database Schema

### flights table (NEW COLUMNS)

```sql
ALTER TABLE flights ADD COLUMN (
  gpx_file_path TEXT,              -- Path to GPX file
  gpx_max_altitude_m INTEGER,      -- Extracted from GPX
  gpx_min_altitude_m INTEGER,
  gpx_elevation_gain_m INTEGER,
  gpx_elevation_loss_m INTEGER,
  gpx_total_distance_km REAL,
  notes TEXT,                      -- User comments
  weather_on_flight_day INTEGER,   -- Para-index for that day
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flights_gpx_path ON flights(gpx_file_path);
```

---

## Backend Implementation

### Endpoints (FastAPI)

#### POST /webhooks/strava (Webhook Receiver)

```python
from fastapi import APIRouter, Request, HTTPException
from datetime import datetime
import httpx
import os

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/strava")
async def strava_webhook(request: Request):
    """
    Receive Strava webhook for new activities
    - Validate signature
    - Download GPX
    - Parse and store
    - Send Telegram notification
    """
    
    # 1. Validate webhook signature
    signature = request.headers.get('X-Strava-Signature')
    body = await request.body()
    
    if not validate_strava_signature(signature, body):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    data = await request.json()
    
    # 2. Check if it's a paragliding activity (sport_type = 'Paragliding')
    if data.get('object_type') != 'activity':
        return {'ok': True}  # Ignore non-activities
    
    strava_activity_id = data['object_id']
    
    # 3. Fetch full activity details from Strava API
    strava_client = StravaClient(os.getenv('STRAVA_KEY'))
    activity = await strava_client.get_activity(strava_activity_id)
    
    if activity['sport_type'] != 'Paragliding':
        return {'ok': True}  # Ignore non-paragliding
    
    # 4. Download GPX
    gpx_content = await strava_client.get_activity_gpx(strava_activity_id)
    
    # 5. Parse GPX and extract coordinates
    coords = parse_gpx(gpx_content)
    stats = calculate_elevation_stats(coords)
    
    # 6. Save GPX file locally
    gpx_path = f"/workspace/paragliding/flights/gpx/strava_{strava_activity_id}.gpx"
    os.makedirs(os.path.dirname(gpx_path), exist_ok=True)
    with open(gpx_path, 'w') as f:
        f.write(gpx_content)
    
    # 7. Insert flight in database
    flight = {
        'strava_id': strava_activity_id,
        'title': activity['name'],
        'site_id': match_site(activity['start_latlng']),  # Match to Arguel, Mont Poupet, etc.
        'flight_date': activity['start_date'].date(),
        'duration_minutes': int(activity['moving_time'] / 60),
        'max_altitude_m': activity.get('elevation_gain'),  # Approximate
        'distance_km': activity['distance'] / 1000,
        'gpx_file_path': gpx_path,
        'gpx_max_altitude_m': stats['max_altitude_m'],
        'gpx_min_altitude_m': stats['min_altitude_m'],
        'gpx_elevation_gain_m': stats['elevation_gain_m'],
        'gpx_elevation_loss_m': stats['elevation_loss_m'],
        'gpx_total_distance_km': stats['total_distance_km'],
    }
    
    db.flights.insert_one(flight)
    
    # 8. Send Telegram notification
    send_telegram_message(
        f"""
🪂 Vol ajouté!
Spot: {flight['site_id']}
Date: {flight['flight_date']}
Durée: {flight['duration_minutes']}min
Altitude: {flight['gpx_max_altitude_m']}m

[Ajouter des notes]
[Voir en 3D]
        """
    )
    
    return {'ok': True, 'flight_id': flight['_id']}
```

#### GET /flights/{flight_id}/gpx (Download GPX)

```python
@router.get("/flights/{flight_id}/gpx")
async def download_gpx(flight_id: str):
    """Download GPX file"""
    flight = db.flights.find_one({'_id': ObjectId(flight_id)})
    
    if not flight or not flight.get('gpx_file_path'):
        raise HTTPException(status_code=404, detail="GPX not found")
    
    return FileResponse(
        flight['gpx_file_path'],
        media_type="application/gpx+xml",
        filename=f"flight_{flight_id}.gpx"
    )
```

#### GET /flights/{flight_id}/gpx-data (GPX Coordinates)

```python
@router.get("/flights/{flight_id}/gpx-data")
async def get_gpx_data(flight_id: str):
    """
    Get parsed GPX data (coordinates + elevation)
    Used by Cesium viewer
    """
    flight = db.flights.find_one({'_id': ObjectId(flight_id)})
    
    if not flight or not flight.get('gpx_file_path'):
        raise HTTPException(status_code=404, detail="GPX not found")
    
    # Parse GPX if not cached
    coords = parse_gpx_file(flight['gpx_file_path'])
    
    return {
        'coordinates': coords,
        'max_altitude_m': flight['gpx_max_altitude_m'],
        'min_altitude_m': flight['gpx_min_altitude_m'],
        'elevation_gain_m': flight['gpx_elevation_gain_m'],
        'elevation_loss_m': flight['gpx_elevation_loss_m'],
        'total_distance_km': flight['gpx_total_distance_km'],
        'flight_duration_seconds': flight['duration_minutes'] * 60,
    }
```

---

## Frontend Implementation

### TypeScript Hooks

#### useCesiumViewer.ts

Hook for managing Cesium 3D viewer:
- Initialize Cesium viewer
- Draw polyline track
- Play replay animation
- Zoom to track
- Take screenshots

Features:
- Type-safe with TypeScript
- Automatic terrain loading
- 3D navigation
- Marker start/end points

#### useFlightGPX.ts

Hook for fetching GPX data:
- `useFlightGPX()` — Fetch coordinates (TanStack Query cached)
- `useDownloadGPX()` — Download file as attachment
- `parseGPXFile()` — Parse local GPX files
- `calculateElevationStats()` — Calculate elevation profile

#### FlightViewer3D.tsx

Main component:
- Cesium 3D viewer
- Track visualization
- Elevation profile chart
- Replay controls (10-120 seconds)
- Flight statistics
- Download GPX button

Props:
```tsx
<FlightViewer3D
  flightId="12345"
  flightTitle="Flight to Mont Poupet"
  showReplay={true}
  showElevationChart={true}
/>
```

---

## Tech Stack

**Backend:**
- FastAPI endpoints
- GPX parsing (xml library)
- Strava API client
- File storage (local disk)

**Frontend:**
- **Cesium.js** (3D viewer engine)
- **Resium** (React wrapper - optional, not used in this simple version)
- **React 18** hooks
- **TypeScript** for type safety
- **Chart.js** for elevation profile
- **TanStack Query** for data fetching + caching

**Storage:**
- Local filesystem: `/workspace/paragliding/flights/gpx/`
- Database: GPX metadata in flights table

---

## Implementation Checklist (Phase 2 Week 4 + Phase 3 Week 1)

### Backend (Week 4)

- [ ] Create POST /webhooks/strava endpoint
- [ ] Implement Strava signature validation
- [ ] Download GPX from Strava API
- [ ] Parse GPX → Extract coordinates + elevation
- [ ] Save GPX files locally
- [ ] Insert flight metadata in DB
- [ ] Create GET /flights/{id}/gpx endpoint
- [ ] Create GET /flights/{id}/gpx-data endpoint
- [ ] Send Telegram notification on new flight
- [ ] Tests for all endpoints

### Frontend (Phase 3 Week 1-2)

- [ ] Install Cesium.js + dependencies
- [ ] Create useCesiumViewer.ts hook
- [ ] Create useFlightGPX.ts hook
- [ ] Create FlightViewer3D.tsx component
- [ ] Elevation profile chart integration
- [ ] Replay animation controls
- [ ] Download GPX functionality
- [ ] Responsive CSS
- [ ] Mobile compatibility
- [ ] Error handling + loading states

---

## Example Usage

### Backend - Webhook Flow

```python
# 1. Strava sends webhook
# {
#   "object_type": "activity",
#   "object_id": 12345,
#   "aspect_type": "create",
#   ...
# }

# 2. Our endpoint processes it
POST /webhooks/strava
→ Downloads GPX
→ Parses coordinates
→ Saves to /flights/gpx/strava_12345.gpx
→ Inserts in flights table
→ Sends Telegram notification

# 3. User gets message
"🪂 Vol ajouté! [Add Notes] [View 3D]"
```

### Frontend - View Flight

```tsx
// In flight list component
<button onClick={() => navigate({ to: `/flights/${flight.id}/view` })}>
  View 3D
</button>

// In flight detail page
<FlightViewer3D
  flightId={flightId}
  flightTitle={flight.title}
  showReplay={true}
  showElevationChart={true}
/>

// User sees:
// 1. 3D Cesium viewer with track
// 2. Elevation profile chart
// 3. Flight stats (max altitude, duration, distance)
// 4. Replay button (10-120 seconds)
// 5. Download GPX button
// 6. Notes form (for comments)
```

---

## Performance Considerations

**GPX File Size:**
- Typical flight: 50 KB
- 1000 flights: 50 MB (negligible)

**Cesium Viewer:**
- Lightweight for single track visualization
- Terrain loading is free (from USGS/Bing)
- No API key required for basic functionality

**Database:**
- Cache GPX data (TanStack Query, 1 hour staleTime)
- Index on `flight_date` and `gpx_file_path` for fast lookups

**Storage:**
- Keep all GPX files (cheap storage)
- Regular backups of `/flights/gpx/` directory

---

## Future Enhancements (Phase 4+)

- [ ] Compare multiple flights (overlay tracks)
- [ ] Flight statistics dashboard (best flights, trends)
- [ ] Weather conditions on flight day (correlation)
- [ ] Share flights with other paragliders
- [ ] Heat map of popular spots
- [ ] Live tracking during flight (WebSocket)
- [ ] Mobile app with offline GPX viewing

---

**Implementation Timeline:**
- Phase 2 Week 4: Backend webhook + GPX storage
- Phase 3 Week 1-2: Frontend Cesium viewer
- **Launch:** May 10, 2026

**Files Created:**
- ✅ `frontend/src/hooks/useCesiumViewer.ts`
- ✅ `frontend/src/hooks/useFlightGPX.ts`
- ✅ `frontend/src/components/FlightViewer3D.tsx`
- ✅ `frontend/src/components/FlightViewer3D.css`
- ✅ Backend endpoints (in Phase 2 implementation)
