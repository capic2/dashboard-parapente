# Dashboard Parapente - API Specification

**Version:** 1.0  
**Status:** Design Phase (Not yet implemented)  
**Author:** Claw, for Vincent  
**Date:** 2026-02-26  

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Handling](#error-handling)
5. [Endpoints](#endpoints)
   - [Sites](#sites)
   - [Flights](#flights)
   - [Weather Forecasts](#weather-forecasts)
   - [Weather History](#weather-history)
   - [Alerts](#alerts)
   - [Statistics](#statistics)
   - [Dashboard](#dashboard)
6. [Rate Limiting](#rate-limiting)
7. [Webhooks](#webhooks)

---

## Overview

The Dashboard Parapente API provides access to:
- **Flights**: Personal flight data (synced from Strava)
- **Weather**: Real-time & forecasted weather from 8 sources
- **Alerts**: User-defined weather alerts & notifications
- **Statistics**: Learning progress & flight analytics
- **Dashboard**: Aggregated views for quick overview

**Base URL:** `https://dashboard.parapente.local/api/v1`  
**Protocol:** HTTPS (required in production)  
**Content-Type:** `application/json`  

---

## Authentication

### API Keys

All requests require an API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

### Scopes

API keys can be scoped to limit access:

- `read:forecast` — Read weather forecasts
- `read:history` — Read weather history
- `read:flights` — Read flight data
- `write:flights` — Create/update flights (Strava sync)
- `read:alerts` — Read alert configuration
- `write:alerts` — Create/update alerts
- `read:stats` — Read statistics
- `admin:all` — Full access (admin only)

### Token Validation

```
POST /auth/validate
Headers: Authorization: Bearer TOKEN
Response: 
{
  "valid": true,
  "user_id": "vincent",
  "scopes": ["read:forecast", "write:alerts"],
  "expires_at": "2026-03-26T11:58:00Z"
}
```

---

## Response Format

### Success Response (2xx)

```json
{
  "success": true,
  "data": { /* response data */ },
  "meta": {
    "timestamp": "2026-02-26T11:58:00Z",
    "request_id": "req-12345",
    "version": "1.0"
  }
}
```

### Error Response (4xx, 5xx)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required parameter: site_id",
    "details": { /* optional debugging info */ }
  },
  "meta": {
    "timestamp": "2026-02-26T11:58:00Z",
    "request_id": "req-12345"
  }
}
```

### Pagination

List endpoints support pagination:

```json
{
  "success": true,
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_count": 150,
    "total_pages": 8,
    "has_next": true,
    "has_previous": false
  }
}
```

---

## Error Handling

### Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Insufficient permissions for this resource |
| `NOT_FOUND` | 404 | Resource does not exist |
| `INVALID_REQUEST` | 400 | Malformed request (missing fields, invalid types) |
| `RATE_LIMITED` | 429 | Too many requests (see rate limiting) |
| `UNPROCESSABLE_ENTITY` | 422 | Request is valid but contains conflicting data |
| `INTERNAL_ERROR` | 500 | Server error (please report) |

---

## Endpoints

### Sites

#### List Sites
```
GET /sites
Query Parameters:
  - page: int (default: 1)
  - page_size: int (default: 20, max: 100)
  - region: string (filter by region, e.g., "Bourgogne-Franche-Comté")
  - active_only: boolean (default: true, only sites with recent weather)

Response:
{
  "data": [
    {
      "id": "uuid-1",
      "code": "arguel",
      "name": "Arguel",
      "elevation_m": 427,
      "latitude": 47.2823,
      "longitude": 6.1742,
      "region": "Bourgogne-Franche-Comté",
      "country": "FR",
      "description": "Popular cross-country site near Besançon"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### Get Site Details
```
GET /sites/{site_id}

Response:
{
  "id": "uuid-1",
  "code": "arguel",
  "name": "Arguel",
  "elevation_m": 427,
  "latitude": 47.2823,
  "longitude": 6.1742,
  "region": "Bourgogne-Franche-Comté",
  "created_at": "2026-02-01T00:00:00Z",
  "updated_at": "2026-02-26T11:58:00Z"
}
```

#### Create Site (Admin only)
```
POST /sites
Required: code, name, elevation_m, latitude, longitude
Optional: description, region, country

Payload:
{
  "code": "new-site",
  "name": "New Flying Site",
  "elevation_m": 600,
  "latitude": 47.5,
  "longitude": 6.0,
  "region": "Bourgogne-Franche-Comté"
}

Response: { new site object }
```

---

### Flights

#### List Flights
```
GET /flights
Query Parameters:
  - page: int (default: 1)
  - page_size: int (default: 20)
  - site_id: uuid (filter by site)
  - from_date: date (YYYY-MM-DD, filter flights after this date)
  - to_date: date (filter flights before this date)
  - sort: string (default: "flight_date:desc", also "duration:desc", "max_altitude:desc")

Response:
{
  "data": [
    {
      "id": "uuid-1",
      "site_id": "uuid-arguel",
      "site_name": "Arguel",
      "title": "Evening thermal run",
      "flight_date": "2026-02-25",
      "duration_minutes": 45,
      "max_altitude_m": 850,
      "max_speed_kmh": 28.5,
      "distance_km": 12.3,
      "elevation_gain_m": 425,
      "notes": "Great thermals, landing smooth",
      "strava_id": "12345678",
      "external_url": "https://strava.com/activities/12345678"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### Get Flight Details
```
GET /flights/{flight_id}

Response:
{
  "id": "uuid-1",
  "site_id": "uuid-arguel",
  "site_name": "Arguel",
  "title": "Evening thermal run",
  "description": "Started from launch area around 18:00...",
  "flight_date": "2026-02-25",
  "duration_minutes": 45,
  "max_altitude_m": 850,
  "max_speed_kmh": 28.5,
  "distance_km": 12.3,
  "elevation_gain_m": 425,
  "notes": "Great thermals, landing smooth",
  "strava_id": "12345678",
  "external_url": "https://strava.com/activities/12345678",
  "created_at": "2026-02-25T19:30:00Z",
  "updated_at": "2026-02-25T19:30:00Z"
}
```

#### Create/Update Flight (Manual entry)
```
POST /flights
Scopes: write:flights

Payload:
{
  "site_id": "uuid-arguel",
  "title": "Morning flight",
  "flight_date": "2026-02-26",
  "duration_minutes": 60,
  "max_altitude_m": 900,
  "max_speed_kmh": 32.0,
  "distance_km": 15.5,
  "elevation_gain_m": 473,
  "notes": "Strong thermals, good visibility"
}

Response: { flight object }
```

#### Sync Flights from Strava
```
POST /flights/sync
Scopes: write:flights

Payload: {} (triggers background sync)

Response:
{
  "status": "syncing",
  "job_id": "sync-12345",
  "message": "Strava sync initiated"
}

Check status:
GET /flights/sync/{job_id}

Response:
{
  "job_id": "sync-12345",
  "status": "completed",
  "flights_synced": 3,
  "new_flights": 2,
  "updated_flights": 1,
  "completed_at": "2026-02-26T11:58:00Z"
}
```

---

### Weather Forecasts

#### Current Conditions (All Sites)
```
GET /weather/current
Query Parameters:
  - sources: string (comma-separated source codes, e.g., "open-meteo,meteoblue")
  - details: boolean (default: false, include all forecast fields)

Response:
{
  "data": {
    "timestamp": "2026-02-26T11:58:00Z",
    "sites": [
      {
        "site_id": "uuid-arguel",
        "site_name": "Arguel",
        "site_elevation_m": 427,
        "conditions": [
          {
            "source": "open-meteo",
            "temperature_c": 12.5,
            "humidity_percent": 65,
            "wind_speed_kmh": 15.0,
            "wind_direction_deg": 270,
            "wind_gust_kmh": 22.5,
            "pressure_hpa": 1013.25,
            "cloud_cover_percent": 30,
            "visibility_km": 10,
            "para_index": 65,
            "fetched_at": "2026-02-26T11:50:00Z"
          },
          {
            "source": "meteoblue",
            "temperature_c": 12.0,
            "wind_speed_kmh": 14.5,
            "para_index": 60,
            "fetched_at": "2026-02-26T11:45:00Z"
          }
        ]
      }
    ]
  }
}
```

#### Get Forecast for Site
```
GET /weather/forecast/{site_id}
Query Parameters:
  - days: int (default: 7, max: 14)
  - source_id: uuid (optional, get from specific source only)
  - hourly: boolean (default: false, show hourly data if available)

Response:
{
  "site_id": "uuid-arguel",
  "site_name": "Arguel",
  "forecasts": [
    {
      "forecast_date": "2026-02-26",
      "time_slot": "12:00",  // if hourly
      "temperature_c": 12.5,
      "humidity_percent": 65,
      "wind_speed_kmh": 15.0,
      "wind_direction_deg": 270,
      "wind_gust_kmh": 22.5,
      "cloud_cover_percent": 30,
      "precipitation_mm": 0.0,
      "precipitation_probability": 0,
      "uv_index": 3.5,
      "para_index": 65,
      "stability_index": 7,
      "thermal_index": 6,
      "sources": [
        {
          "source": "open-meteo",
          "para_index": 65,
          "fetched_at": "2026-02-26T11:50:00Z"
        }
      ]
    }
  ],
  "generated_at": "2026-02-26T11:58:00Z"
}
```

#### Get Forecast Comparison (Multiple sources)
```
GET /weather/forecast/{site_id}/comparison
Query Parameters:
  - forecast_date: date (YYYY-MM-DD)

Response:
{
  "site_id": "uuid-arguel",
  "site_name": "Arguel",
  "forecast_date": "2026-02-26",
  "sources": [
    {
      "source": "open-meteo",
      "para_index": 65,
      "temperature_c": 12.5,
      "wind_speed_kmh": 15.0,
      "confidence_percent": 85,
      "fetched_at": "2026-02-26T11:50:00Z"
    },
    {
      "source": "meteoblue",
      "para_index": 60,
      "temperature_c": 12.0,
      "wind_speed_kmh": 14.5,
      "confidence_percent": 80,
      "fetched_at": "2026-02-26T11:45:00Z"
    }
  ],
  "consensus": {
    "para_index": 62,  // average
    "recommendation": "Marginal conditions - proceed with caution"
  }
}
```

---

### Weather History

#### Get Historical Weather
```
GET /weather/history/{site_id}
Query Parameters:
  - from_date: date (required, YYYY-MM-DD)
  - to_date: date (default: today)
  - source_id: uuid (optional, filter by source)

Response:
{
  "site_id": "uuid-arguel",
  "site_name": "Arguel",
  "period": {
    "from_date": "2026-02-19",
    "to_date": "2026-02-26"
  },
  "observations": [
    {
      "observation_date": "2026-02-26",
      "observation_time": "12:00",
      "temperature_c": 12.5,
      "humidity_percent": 65,
      "wind_speed_kmh": 15.0,
      "wind_direction_deg": 270,
      "cloud_cover_percent": 30,
      "was_flyable": true,
      "source": "open-meteo"
    }
  ]
}
```

#### Weather Statistics (Aggregated)
```
GET /weather/statistics/{site_id}
Query Parameters:
  - from_date: date (required)
  - to_date: date (default: today)

Response:
{
  "site_id": "uuid-arguel",
  "site_name": "Arguel",
  "period": {
    "from_date": "2026-02-19",
    "to_date": "2026-02-26",
    "days_analyzed": 8
  },
  "temperature": {
    "avg_c": 11.2,
    "min_c": 8.5,
    "max_c": 14.8
  },
  "wind": {
    "avg_speed_kmh": 12.3,
    "min_speed_kmh": 5.0,
    "max_speed_kmh": 28.5,
    "dominant_direction_deg": 270,
    "gusty_days": 3
  },
  "conditions": {
    "flyable_days": 5,
    "marginal_days": 2,
    "unflyable_days": 1,
    "avg_cloud_cover_percent": 45
  }
}
```

---

### Alerts

#### List Alerts
```
GET /alerts
Query Parameters:
  - page: int (default: 1)
  - page_size: int (default: 20)
  - site_id: uuid (optional)
  - active_only: boolean (default: true)

Response:
{
  "data": [
    {
      "id": "uuid-alert-1",
      "site_id": "uuid-arguel",
      "site_name": "Arguel",
      "name": "Strong wind warning",
      "condition_type": "wind_speed",
      "condition_operator": ">=",
      "condition_value": 25.0,
      "alert_method": "telegram",
      "destination": "123456789",  // Telegram chat ID
      "is_active": true,
      "created_at": "2026-02-20T10:00:00Z",
      "updated_at": "2026-02-26T11:58:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### Get Alert Details
```
GET /alerts/{alert_id}

Response:
{
  "id": "uuid-alert-1",
  "site_id": "uuid-arguel",
  "site_name": "Arguel",
  "name": "Strong wind warning",
  "condition_type": "wind_speed",
  "condition_operator": ">=",
  "condition_value": 25.0,
  "alert_method": "telegram",
  "destination": "123456789",
  "is_active": true,
  "last_triggered": "2026-02-25T14:30:00Z",
  "trigger_count": 3,
  "created_at": "2026-02-20T10:00:00Z",
  "updated_at": "2026-02-26T11:58:00Z"
}
```

#### Create Alert
```
POST /alerts
Scopes: write:alerts

Payload:
{
  "site_id": "uuid-arguel",
  "name": "Good flying conditions",
  "condition_type": "para_index",
  "condition_operator": ">=",
  "condition_value": 70,
  "alert_method": "telegram",
  "destination": "123456789"
}

Response: { alert object }
```

#### Update Alert
```
PATCH /alerts/{alert_id}
Scopes: write:alerts

Payload:
{
  "condition_value": 75,
  "is_active": false
}

Response: { updated alert object }
```

#### Delete Alert
```
DELETE /alerts/{alert_id}
Scopes: write:alerts

Response: { "success": true, "message": "Alert deleted" }
```

#### Alert History
```
GET /alerts/{alert_id}/history
Query Parameters:
  - page: int (default: 1)
  - page_size: int (default: 50)

Response:
{
  "alert_id": "uuid-alert-1",
  "alert_name": "Strong wind warning",
  "triggers": [
    {
      "id": "uuid-trigger-1",
      "triggered_at": "2026-02-25T14:30:00Z",
      "sent_at": "2026-02-25T14:31:00Z",
      "status": "sent",
      "value_at_trigger": 27.5,
      "forecast_para_index": 55
    }
  ],
  "pagination": { /* ... */ }
}
```

---

### Statistics

#### Flight Statistics
```
GET /statistics/flights
Query Parameters:
  - period: string (default: "all_time", also "week", "month", "year")
  - from_date: date (optional, overrides period)
  - to_date: date (optional)

Response:
{
  "period": {
    "type": "all_time",
    "from_date": "2026-01-01",
    "to_date": "2026-02-26"
  },
  "flights": {
    "total_count": 6,
    "total_duration_hours": 4.5,
    "avg_duration_minutes": 45,
    "max_altitude_m": 950,
    "max_speed_kmh": 35.2,
    "total_distance_km": 67.8,
    "avg_elevation_gain_m": 385
  },
  "learning": {
    "skill_level": "beginner",
    "is_improving": true,
    "consistency_score": 72,  // 0-100
    "improvement_trend": 1.2  // % improvement week-over-week
  },
  "by_site": [
    {
      "site_id": "uuid-arguel",
      "site_name": "Arguel",
      "flights": 3,
      "total_duration_minutes": 135
    }
  ]
}
```

#### Weather Correlation (Forecast Accuracy)
```
GET /statistics/weather-accuracy
Query Parameters:
  - from_date: date (required)
  - to_date: date (default: today)
  - site_id: uuid (optional)

Response:
{
  "period": {
    "from_date": "2026-02-01",
    "to_date": "2026-02-26"
  },
  "accuracy": [
    {
      "source": "open-meteo",
      "avg_accuracy_percent": 78,
      "predictions_analyzed": 26,
      "mean_error_para_index": 5.3,
      "trend": "improving"
    },
    {
      "source": "meteoblue",
      "avg_accuracy_percent": 72,
      "predictions_analyzed": 24,
      "mean_error_para_index": 7.2,
      "trend": "stable"
    }
  ]
}
```

---

### Dashboard

#### Dashboard Overview (All-in-one view)
```
GET /dashboard

Query Parameters:
  - site_id: uuid (optional, focus on single site; default: show all)

Response:
{
  "timestamp": "2026-02-26T11:58:00Z",
  "user": "vincent",
  
  "current_conditions": {
    // See weather/current endpoint
  },
  
  "forecast": {
    "next_7_days": [
      // Daily forecast summary for all sites
    ],
    "best_days": [
      {
        "date": "2026-02-28",
        "best_site": "mont-poupet",
        "para_index": 78,
        "condition": "Excellent"
      }
    ]
  },
  
  "recent_flights": [
    // Last 3 flights
  ],
  
  "statistics": {
    "total_flights": 6,
    "total_hours": 4.5,
    "skill_level": "beginner",
    "is_improving": true
  },
  
  "alerts": {
    "active_count": 3,
    "recent_triggers": 2  // In last 24 hours
  },
  
  "recommendations": [
    {
      "type": "good_conditions",
      "site": "mont-poupet",
      "date": "2026-02-28",
      "reason": "High thermal index + moderate winds"
    }
  ]
}
```

#### Dashboard Settings
```
GET /dashboard/settings

Response:
{
  "user_id": "vincent",
  "theme": "light",
  "language": "fr",
  "preferred_units": "metric",
  "default_site_id": "uuid-arguel",
  "forecast_horizon_days": 7,
  "historical_days": 30,
  "refresh_interval_minutes": 30
}

PATCH /dashboard/settings
Payload:
{
  "theme": "dark",
  "forecast_horizon_days": 10
}
```

---

## Rate Limiting

### Limits

| Endpoint Category | Requests/Hour | Burst (per minute) |
|------------------|---------------|-------------------|
| Weather (read)   | 1,000         | 50                |
| Flights (read)   | 500           | 30                |
| Flights (write)  | 100           | 10                |
| Alerts (write)   | 200           | 20                |
| Dashboard        | 600           | 40                |

### Rate Limit Headers

Every response includes:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 2026-02-26T12:58:00Z
X-RateLimit-Retry-After: 30
```

When rate limited (429):
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "API rate limit exceeded",
    "retry_after_seconds": 30
  },
  "meta": {
    "timestamp": "2026-02-26T11:58:00Z"
  }
}
```

---

## Webhooks

### Webhook Events

Configure webhooks to receive real-time notifications:

```
POST /webhooks

Payload:
{
  "url": "https://your-server.com/webhook",
  "events": [
    "forecast.updated",
    "alert.triggered",
    "flight.synced"
  ],
  "active": true
}
```

### Event Examples

#### forecast.updated
```json
{
  "event": "forecast.updated",
  "timestamp": "2026-02-26T11:58:00Z",
  "data": {
    "site_id": "uuid-arguel",
    "site_name": "Arguel",
    "source": "open-meteo",
    "new_para_index": 65,
    "change_from_previous": 3
  }
}
```

#### alert.triggered
```json
{
  "event": "alert.triggered",
  "timestamp": "2026-02-26T11:58:00Z",
  "data": {
    "alert_id": "uuid-alert-1",
    "alert_name": "Strong wind warning",
    "site_id": "uuid-arguel",
    "condition_met": {
      "type": "wind_speed",
      "value": 27.5,
      "threshold": 25.0
    }
  }
}
```

#### flight.synced
```json
{
  "event": "flight.synced",
  "timestamp": "2026-02-26T11:58:00Z",
  "data": {
    "sync_job_id": "sync-12345",
    "flights_synced": 3,
    "new_flights": 2,
    "updated_flights": 1
  }
}
```

---

## Versioning & Deprecation

- **Current Version:** v1
- **Deprecated Endpoints:** None yet
- **Sunset Policy:** Deprecated endpoints are supported for 6 months after replacement

Changes between versions:
- New endpoints added
- Breaking changes announced 3 months in advance

---

## Code Examples

### Python (Requests)
```python
import requests

API_KEY = "your-api-key"
BASE_URL = "https://dashboard.parapente.local/api/v1"

headers = {"Authorization": f"Bearer {API_KEY}"}

# Get current conditions
response = requests.get(f"{BASE_URL}/weather/current", headers=headers)
conditions = response.json()

# Create an alert
alert_data = {
    "site_id": "uuid-arguel",
    "name": "Wind alert",
    "condition_type": "wind_speed",
    "condition_operator": ">=",
    "condition_value": 25,
    "alert_method": "telegram",
    "destination": "123456789"
}
response = requests.post(f"{BASE_URL}/alerts", json=alert_data, headers=headers)
```

### JavaScript/Node.js (Fetch)
```javascript
const API_KEY = "your-api-key";
const BASE_URL = "https://dashboard.parapente.local/api/v1";

const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json"
};

// Get dashboard overview
const response = await fetch(`${BASE_URL}/dashboard`, { headers });
const data = await response.json();

console.log("Current conditions:", data.current_conditions);
```

### cURL
```bash
# Get weather forecast
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://dashboard.parapente.local/api/v1/weather/forecast/{site_id}"

# Create alert
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "uuid-arguel",
    "name": "Wind alert",
    "condition_type": "wind_speed",
    "condition_operator": ">=",
    "condition_value": 25,
    "alert_method": "telegram",
    "destination": "123456789"
  }' \
  "https://dashboard.parapente.local/api/v1/alerts"
```

---

## Future Enhancements

- [ ] WebSocket support for real-time weather updates
- [ ] Graphical weather comparison charts
- [ ] Machine learning for condition prediction
- [ ] Social features (share flights, compare routes)
- [ ] Mobile app API optimization
- [ ] Export to GPX/KML formats

---

**End of API Specification**
