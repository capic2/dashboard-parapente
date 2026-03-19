# 📡 API Documentation

> **REST API Reference for Dashboard Parapente**

---

## Base URL

**Development:** `http://localhost:8000`  
**Production:** `https://your-domain.com`

All endpoints are prefixed with `/api`

---

## Authentication

Currently: **No authentication required** (personal dashboard)

Future: JWT token-based authentication

---

## Endpoints

### Weather

#### Get Combined Weather Forecast

Retrieve aggregated weather forecast from all sources with consensus data.

```http
GET /api/weather/combined/{site_id}/{day_index}
```

**Parameters:**
- `site_id` (path, required): Site identifier (e.g., `site-arguel`)
- `day_index` (path, required): Day offset from today (0 = today, 1 = tomorrow, etc.)

**Response:** `200 OK`

```json
{
  "site_id": "site-arguel",
  "site_name": "Arguel",
  "day_index": 0,
  "para_index": 75,
  "verdict": "GOOD",
  "explanation": "Good flying conditions with moderate wind",
  "slots_summary": "Morning: EXCELLENT, Afternoon: GOOD",
  "consensus": [
    {
      "hour": 14,
      "temperature": 18.5,
      "wind_speed": 12.3,
      "wind_gust": 18.7,
      "wind_direction": 225,
      "precipitation": 0.0,
      "cloud_cover": 45,
      "num_sources": 5,
      "sources": {
        "open-meteo": {...},
        "weatherapi": {...},
        "meteoblue": {...}
      }
    }
  ],
  "metrics": {
    "avg_temp_c": 17.2,
    "avg_wind_kmh": 11.5,
    "max_gust_kmh": 22.1,
    "total_rain_mm": 0.0
  }
}
```

**Errors:**
- `404 Not Found`: Site not found
- `500 Internal Server Error`: Weather data unavailable

---

#### Get Weather from Specific Source

Retrieve weather data from a single source (for comparison).

```http
GET /api/weather/{source}/{site_id}/{day_index}
```

**Parameters:**
- `source` (path, required): Weather source name
  - `open-meteo`
  - `weatherapi`
  - `meteoblue`
  - `meteo-parapente`
  - `meteociel`
- `site_id` (path, required): Site identifier
- `day_index` (path, required): Day offset (0-6)

**Response:** `200 OK`

```json
{
  "source": "open-meteo",
  "site_id": "site-arguel",
  "hourly": [
    {
      "time": "2026-03-03T14:00:00Z",
      "temperature": 18.5,
      "wind_speed": 12.3,
      "wind_direction": 225,
      "precipitation": 0.0,
      "cloud_cover": 45
    }
  ]
}
```

---

### Sites

#### List All Sites

Get all flying sites.

```http
GET /api/sites
```

**Response:** `200 OK`

```json
{
  "sites": [
    {
      "id": "site-arguel",
      "name": "Arguel",
      "latitude": 47.2347,
      "longitude": 6.0234,
      "elevation_m": 427,
      "orientation": "N",
      "rating": 4,
      "is_active": true
    },
    {
      "id": "mont-poupet-nord",
      "name": "Mont Poupet Nord",
      "latitude": 46.9123,
      "longitude": 5.8456,
      "elevation_m": 842,
      "orientation": "N",
      "rating": 5,
      "is_active": true
    }
  ]
}
```

---

#### Get Site Details

Get detailed information about a specific site.

```http
GET /api/sites/{site_id}
```

**Parameters:**
- `site_id` (path, required): Site identifier

**Response:** `200 OK`

```json
{
  "id": "site-arguel",
  "name": "Arguel",
  "latitude": 47.2347,
  "longitude": 6.0234,
  "elevation_m": 427,
  "orientation": "N",
  "description": "Popular beginner site near Besançon",
  "difficulty_level": "beginner",
  "rating": 4,
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z"
}
```

**Errors:**
- `404 Not Found`: Site not found

---

### Flights

#### List Flights

Get flight history with optional filters.

```http
GET /api/flights?site_id={site_id}&date_from={date}&date_to={date}&limit={limit}
```

**Query Parameters:**
- `site_id` (optional): Filter by site
- `date_from` (optional): Start date (ISO 8601)
- `date_to` (optional): End date (ISO 8601)
- `limit` (optional): Max results (default: 100)

**Response:** `200 OK`

```json
{
  "flights": [
    {
      "id": "flight-001",
      "site_id": "site-arguel",
      "site_name": "Arguel",
      "title": "Afternoon flight",
      "flight_date": "2026-03-01T14:30:00Z",
      "duration_minutes": 45,
      "max_altitude_m": 850,
      "distance_km": 12.5,
      "elevation_gain_m": 423,
      "notes": "Great thermals!",
      "gpx_file_path": "gpx_files/flight-001.gpx"
    }
  ]
}
```

---

#### Get Flight Details

Get detailed information about a specific flight.

```http
GET /api/flights/{flight_id}
```

**Parameters:**
- `flight_id` (path, required): Flight identifier

**Response:** `200 OK`

```json
{
  "id": "flight-001",
  "site_id": "site-arguel",
  "site": {
    "id": "site-arguel",
    "name": "Arguel",
    "latitude": 47.2347,
    "longitude": 6.0234
  },
  "title": "Afternoon flight",
  "flight_date": "2026-03-01T14:30:00Z",
  "duration_minutes": 45,
  "max_altitude_m": 850,
  "distance_km": 12.5,
  "elevation_gain_m": 423,
  "notes": "Great thermals!",
  "gpx_file_path": "gpx_files/flight-001.gpx",
  "created_at": "2026-03-01T18:00:00Z"
}
```

**Errors:**
- `404 Not Found`: Flight not found

---

#### Create Flight

Add a new flight to the log.

```http
POST /api/flights
Content-Type: application/json
```

**Request Body:**

```json
{
  "site_id": "site-arguel",
  "title": "Morning flight",
  "flight_date": "2026-03-03T09:00:00Z",
  "duration_minutes": 60,
  "max_altitude_m": 900,
  "distance_km": 15.2,
  "elevation_gain_m": 473,
  "notes": "Perfect conditions"
}
```

**Response:** `201 Created`

```json
{
  "id": "flight-002",
  "site_id": "site-arguel",
  "title": "Morning flight",
  "flight_date": "2026-03-03T09:00:00Z",
  "duration_minutes": 60,
  "max_altitude_m": 900,
  "distance_km": 15.2,
  "elevation_gain_m": 473,
  "notes": "Perfect conditions",
  "created_at": "2026-03-03T10:30:00Z"
}
```

**Errors:**
- `400 Bad Request`: Invalid data
- `404 Not Found`: Site not found

---

#### Update Flight

Update an existing flight.

```http
PUT /api/flights/{flight_id}
Content-Type: application/json
```

**Request Body:** (same as create)

**Response:** `200 OK` (returns updated flight)

**Errors:**
- `404 Not Found`: Flight not found
- `400 Bad Request`: Invalid data

---

#### Delete Flight

Delete a flight from the log.

```http
DELETE /api/flights/{flight_id}
```

**Response:** `204 No Content`

**Errors:**
- `404 Not Found`: Flight not found

---

### Statistics

#### Get Flight Statistics

Get aggregated flight statistics.

```http
GET /api/stats/flights?site_id={site_id}
```

**Query Parameters:**
- `site_id` (optional): Filter by site

**Response:** `200 OK`

```json
{
  "total_flights": 42,
  "total_hours": 35.5,
  "total_duration_minutes": 2130,
  "total_distance_km": 487.3,
  "total_elevation_gain_m": 15840,
  "avg_duration_minutes": 50.7,
  "avg_distance_km": 11.6,
  "max_altitude_m": 1250,
  "favorite_spot": "site-arguel",
  "favorite_site": {
    "id": "site-arguel",
    "name": "Arguel"
  },
  "last_flight_date": "2026-03-01T14:30:00Z"
}
```

---

### Health Check

#### System Health

Check system health and connectivity.

```http
GET /api/health
```

**Response:** `200 OK`

```json
{
  "status": "healthy",
  "redis": "healthy",
  "database": "healthy",
  "timestamp": "2026-03-03T12:00:00Z"
}
```

**Possible statuses:**
- `healthy`: All systems operational
- `degraded`: Some services down
- `unhealthy`: Critical failure

---

## Rate Limiting

**Development:** No rate limit

**Production:**
- 10 requests/second per IP
- Burst: 20 requests
- 429 Too Many Requests when exceeded

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message describing what went wrong",
  "status_code": 404
}
```

**Common Status Codes:**
- `200 OK`: Success
- `201 Created`: Resource created
- `204 No Content`: Success with no response body
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Data Validation

All requests are validated using Pydantic schemas. Invalid data returns `400 Bad Request` with validation errors:

```json
{
  "detail": [
    {
      "loc": ["body", "flight_date"],
      "msg": "invalid datetime format",
      "type": "value_error.datetime"
    }
  ]
}
```

---

## Caching

Weather data is cached with 30-minute TTL:
- Cache-Control headers included in responses
- Fresh data every 30 minutes via scheduler
- Manual refresh not required

**Cache Headers:**

```http
Cache-Control: public, max-age=1800
ETag: "abc123"
Last-Modified: Mon, 03 Mar 2026 12:00:00 GMT
```

---

## Interactive Documentation

**Swagger UI:** `http://localhost:8000/docs`  
**ReDoc:** `http://localhost:8000/redoc`

Automatically generated from code, always up-to-date.

---

## Example: Fetch Today's Weather

```bash
# Using curl
curl http://localhost:8000/api/weather/combined/site-arguel/0

# Using fetch (JavaScript)
fetch('http://localhost:8000/api/weather/combined/site-arguel/0')
  .then(res => res.json())
  .then(data => console.log(data.para_index));

# Using httpx (Python)
import httpx

response = httpx.get('http://localhost:8000/api/weather/combined/site-arguel/0')
data = response.json()
print(f"Para-Index: {data['para_index']}")
```

---

## Example: Log a Flight

```bash
# Using curl
curl -X POST http://localhost:8000/api/flights \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "site-arguel",
    "title": "Awesome flight",
    "flight_date": "2026-03-03T14:00:00Z",
    "duration_minutes": 45,
    "max_altitude_m": 850,
    "distance_km": 12.5,
    "elevation_gain_m": 423
  }'

# Using fetch (JavaScript)
fetch('http://localhost:8000/api/flights', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    site_id: 'site-arguel',
    title: 'Awesome flight',
    flight_date: '2026-03-03T14:00:00Z',
    duration_minutes: 45,
    max_altitude_m: 850,
    distance_km: 12.5,
    elevation_gain_m: 423
  })
})
.then(res => res.json())
.then(data => console.log('Flight created:', data.id));
```

---

**Last updated:** 2026-03-03  
**API Version:** 1.0
