# 🪂 Dashboard Parapente - Complete Implementation Plan

**Version:** 1.0 (Final - All-in-One Document)  
**Date:** 2026-02-26  
**Status:** Phase 1 Design Complete → Ready for Phase 2 (March 1, 2026)  
**Author:** Claw, for Vincent CAPICOTTO

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Architecture & Technology](#architecture--technology)
4. [Database Design (SQLite)](#database-design-sqlite)
5. [API Specification](#api-specification)
6. [Frontend Structure](#frontend-structure)
7. [Data Sources & Scraping](#data-sources--scraping)
8. [Code Reuse Strategy](#code-reuse-strategy)
9. [Implementation Timeline](#implementation-timeline)
10. [Phase 2: Backend (Detailed)](#phase-2-backend-detailed)
11. [Phase 3: Frontend (Detailed)](#phase-3-frontend-detailed)
12. [Infrastructure & Setup](#infrastructure--setup)
13. [Risk Management](#risk-management)
14. [Success Criteria](#success-criteria)
15. [Appendices](#appendices)

---

## Executive Summary

Personal paragliding weather dashboard combining real-time conditions from 8 sources with flight analytics.

**Key Metrics:**
- **Timeline:** 8-9 weeks (March 1 - May 10, 2026)
- **Effort:** ~70-80 hours total (~4-5 hrs/week)
- **Technology:** Python (FastAPI) + Vue 3 + SQLite
- **Database:** Local SQLite file (zero infrastructure)
- **Code Reuse:** Leveraging existing weather report code (saves 15-20 hours)

**Phases:**
1. ✅ **Phase 1 - Design (Complete):** Schema, API spec, frontend prototype, implementation plan
2. ⏳ **Phase 2 - Backend (6 weeks):** Database, scrapers, pipeline, scheduler
3. ⏳ **Phase 3 - Frontend (4 weeks):** Vue.js UI, API integration, deployment

**Launch:** May 10, 2026 🚀

---

## Project Overview

### Vision

Create a personal flying conditions dashboard optimized for your region that:
- Aggregates real-time weather from 8 independent sources
- Calculates a unified "Para-Index" flying score (0-100)
- Tracks flight history with learning analytics
- Sends intelligent alerts based on custom thresholds
- Identifies the most accurate weather source for your conditions

### Goals

| Goal | Metric | Target |
|------|--------|--------|
| Data Aggregation | Sources integrated | 5/8 (Phase 2), all 8 (Phase 4) |
| Accuracy | Forecast error vs actual | <5°C temp, <3 km/h wind |
| Uptime | Dashboard availability | 99% SLA |
| Performance | Page load time | <2 seconds |
| User Satisfaction | Alert accuracy | 90% |

### Non-Goals (Out of Scope)

- ❌ Social features (Phase 4 only)
- ❌ Mobile app (Phase 4 only)
- ❌ Advanced ML forecasting (Phase 4 only)
- ❌ Integration with flight schools
- ❌ Real-time flight tracking

---

## Architecture & Technology

### Tech Stack

**Backend:**
- **Language:** Python 3.10+
- **Web Framework:** FastAPI (REST API, auto-docs)
- **Database:** SQLite (local file)
- **ORM:** SQLAlchemy (database abstraction)
- **Task Scheduling:** APScheduler (job management)
- **Web Scraping:** Playwright (headless browser) + BeautifulSoup
- **HTTP Client:** aiohttp + requests (async/sync)
- **Testing:** pytest, pytest-cov (>80% coverage target)

**Frontend:**
- **Framework:** React 18+ (hooks)
- **Build Tool:** Vite (fast development)
- **TanStack Suite:**
  - **@tanstack/react-router** — Modern type-safe routing
  - **@tanstack/react-query** — Data fetching, caching, sync
  - **@tanstack/react-table** — Headless table (sorting, filtering, pagination)
  - **@tanstack/react-form** — Type-safe forms with validation
- **State Management:** Zustand (UI state only)
- **HTTP Client:** Axios (wrapped in TanStack Query)
- **Styling:** Tailwind CSS (responsive)
- **Charting:** Chart.js + react-chartjs-2
- **Testing:** Vitest + React Testing Library

**Infrastructure:**
- **Database:** SQLite 3 (single local file)
- **Web Server:** Nginx (reverse proxy, HTTPS)
- **Container:** Docker (optional, for deployment)
- **Deployment:** Local Proxmox/OpenClaw environment

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vue 3)                      │
│  Dashboard with 6 sections + real-time updates          │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
                     ↓
┌─────────────────────────────────────────────────────────┐
│            Nginx Reverse Proxy (Port 443)               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│           FastAPI Backend (Port 8000)                    │
│  ┌──────────────┬──────────────┬──────────────┐         │
│  │  Weather     │   Flights    │   Alerts     │         │
│  │  Endpoints   │  Endpoints   │  Endpoints   │         │
│  └──────┬───────┴──────┬───────┴──────┬───────┘         │
│         │              │              │                 │
└─────────┼──────────────┼──────────────┼─────────────────┘
          │              │              │
          ↓              ↓              ↓
    ┌──────────────────────────────────────┐
    │      SQLite Database (Local File)    │
    │                                      │
    │  • weather_forecasts (8 sources)     │
    │  • flights (Strava sync)             │
    │  • alerts (user-defined)             │
    │  • flight_statistics (analytics)     │
    │  • scraper_health (monitoring)       │
    └──────────────────────────────────────┘

Separate Process (APScheduler):
┌──────────────────────────────────────────────────────────┐
│  Background Job Scheduler                                │
│  ┌──────────────────────────────────────────────┐        │
│  │ Every 30 min: Fetch from 5 weather sources  │        │
│  │ Every 5 min: Check alert triggers           │        │
│  │ Daily: Strava flight sync                   │        │
│  └──────────────────────────────────────────────┘        │
│         │                                                 │
│         └─→ Normalize + Insert to SQLite                │
└──────────────────────────────────────────────────────────┘
```

---

## Database Design (SQLite)

### Schema Overview

**12 Tables:**

1. **sites** — Flying locations (Arguel, Mont Poupet, La Côte)
2. **flights** — Flight history (synced from Strava)
3. **weather_sources** — Data providers (Open-Meteo, WeatherAPI, etc.)
4. **weather_forecasts** — Hourly forecasts from all sources
5. **alerts** — User-defined alert rules
6. **alert_triggers** — Alert history
7. **flight_statistics** — Aggregated stats per site/period
8. **scraper_health** — Data source health tracking
9. **data_quality_logs** — Data validation history
10. Plus 3 views for common queries

### Key Tables

**sites**
```sql
CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,        -- 'arguel', 'mont-poupet'
  name TEXT NOT NULL,
  elevation_m INTEGER,
  latitude REAL,
  longitude REAL,
  region TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initial data:
-- Arguel (427m, 47.22356°N, 6.01842°E)
-- Mont Poupet (842m, 47.16425°N, 5.99234°E)
-- La Côte (800m, 47.18956°N, 6.04567°E)
```

**weather_forecasts**
```sql
CREATE TABLE weather_forecasts (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  source_id TEXT NOT NULL,          -- Reference to weather_sources
  forecast_date DATE NOT NULL,
  forecast_time TIME,               -- Hourly
  
  -- Core meteorological data
  temperature_c REAL,
  humidity_percent INTEGER,
  wind_speed_kmh REAL,
  wind_direction_deg INTEGER,
  wind_gust_kmh REAL,
  cloud_cover_percent INTEGER,
  precipitation_mm REAL,
  uv_index REAL,
  
  -- Paragliding-specific
  thermal_strength INTEGER,         -- 0-5
  thermal_potential TEXT,           -- 'weak', 'moderate', 'strong'
  stability_index REAL,
  
  -- Composite scoring
  para_index INTEGER DEFAULT 50,    -- 0-100
  verdict TEXT,                     -- 'BON', 'MOYEN', 'LIMITE', 'MAUVAIS'
  verdict_reason TEXT,
  
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes optimized for common queries:
-- - (site_id, forecast_date DESC) for "get latest for site"
-- - (para_index DESC) for "best flying days"
-- - (source_id, fetched_at DESC) for "source health"
```

**flights**
```sql
CREATE TABLE flights (
  id TEXT PRIMARY KEY,
  strava_id TEXT UNIQUE,
  site_id TEXT,
  flight_date DATE NOT NULL,
  duration_minutes INTEGER,
  max_altitude_m INTEGER,
  distance_km REAL,
  elevation_gain_m INTEGER,
  
  -- Context from weather on flight day
  avg_wind_speed_kmh REAL,
  para_index_on_flight_day INTEGER,  -- Historical para-index for learning
  
  imported_from TEXT DEFAULT 'strava',
  imported_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**alerts**
```sql
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  site_id TEXT,
  name TEXT NOT NULL,               -- "Wind too high", "Perfect day"
  condition_type TEXT NOT NULL,     -- 'wind', 'temp', 'para_index'
  operator TEXT,                    -- '>', '<', '==', 'between'
  threshold_min REAL,
  threshold_max REAL,
  is_active BOOLEAN DEFAULT 1,
  notify_via TEXT DEFAULT 'telegram',
  created_at DATETIME
);
```

### Initialization

```bash
# Create database
sqlite3 backend/db/dashboard.db < docs/PHASE-1-DESIGN/dashboard-schema-sqlite.sql

# Verify
sqlite3 backend/db/dashboard.db ".tables"
# Output: sites, flights, weather_sources, weather_forecasts, ...
```

---

## API Specification

### Base URL
- Development: `http://localhost:8000/api/v1`
- Production: `https://dashboard.parapente.local/api/v1`

### Authentication
- API key in request header: `X-API-Key: <key>`
- (Optional, for Phase 2+)

### Response Format

**Success (200):**
```json
{
  "ok": true,
  "data": { /* endpoint-specific */ },
  "timestamp": "2026-02-26T14:30:00Z"
}
```

**Error (4xx/5xx):**
```json
{
  "ok": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-02-26T14:30:00Z"
}
```

### Key Endpoints (50+ total)

#### Sites
- `GET /sites` — List all flying sites
- `GET /sites/{site_id}` — Site details
- `POST /sites` — Create site (admin)

#### Weather (Current & Forecast)
- `GET /weather/current` — Latest conditions for all sites
- `GET /weather/current/{site_id}` — Latest for one site
- `GET /weather/forecast/{site_id}` — 7-day hourly forecast
- `GET /weather/history/{site_id}` — Historical weather
- `GET /weather/sources` — All available data sources
- `GET /weather/sources/{source_id}/health` — Source health status

#### Para-Index
- `GET /para-index/today/{site_id}` — Today's score
- `GET /para-index/forecast/{site_id}` — 7-day scores
- `GET /para-index/comparison` — Compare across sites

#### Flights
- `GET /flights` — List all flights (with filters)
- `GET /flights/{flight_id}` — Flight details
- `POST /flights` — Create flight (manual entry)
- `GET /flights/stats` — Learning statistics
- `GET /flights/best-conditions` — Flights in best conditions

#### Alerts
- `GET /alerts` — List user's alerts
- `POST /alerts` — Create alert
- `PATCH /alerts/{alert_id}` — Update alert
- `DELETE /alerts/{alert_id}` — Delete alert
- `GET /alerts/history` — Triggered alert history

#### Statistics
- `GET /stats/learning` — Overall learning progress
- `GET /stats/sites/{site_id}` — Stats per site
- `GET /stats/wind-correlation` — Wind speed vs flight quality

#### System
- `GET /health` — System health check
- `GET /version` — API version

---

## Frontend Structure (React 18)

### Dashboard Sections

**1. Today at a Glance**
- 3 cards (Arguel, Mont Poupet, La Côte)
- Current para-index + verdict
- Best flying window today
- One-line recommendation

**2. 5-Day Forecast**
- Timeline: each day with best site highlighted
- Para-index trend
- Next volable day indicator
- Swipe for details

**3. Recent Flights**
- List of last 5-10 flights with date, duration, site
- Weather conditions during flight
- Link to Strava
- Filter by site/month

**4. Learning Stats**
- Total flights & hours
- Average altitude, distance, duration
- Skill level assessment
- Improvement trend (%)
- Best site for you

**5. Alert Manager**
- Create/edit/delete alerts
- Real-time alerts (Telegram)
- Alert history
- Custom thresholds

**6. Weather Sources**
- All 8 sources listed with health status
- Last update time
- Data accuracy (RMSE vs actual)
- Side-by-side comparison (Open-Meteo vs WeatherAPI vs Meteoblue, etc.)

### React Components Structure (with TanStack)

```
src/
├── components/           # Reusable components
│   ├── CurrentConditions.jsx
│   ├── Forecast7Day.jsx
│   ├── RecentFlights.jsx   (uses useFlightsTable)
│   ├── LearningStats.jsx
│   ├── AlertManager.jsx    (uses useAlertForm)
│   ├── SourceComparison.jsx (uses useWeatherSourcesTable)
│   └── Navigation.jsx      (uses TanStack Router)
│
├── pages/                # Page-level components
│   ├── Dashboard.jsx     (TanStack Router)
│   ├── FlightHistory.jsx (TanStack Table)
│   ├── Settings.jsx
│   └── Admin.jsx
│
├── hooks/                # TanStack hooks
│   ├── useWeather.js          (TanStack Query)
│   ├── useFlights.js          (TanStack Query + Mutations)
│   ├── useAlerts.js           (TanStack Query + Mutations)
│   ├── useAlertForm.js        (TanStack Form)
│   └── useFlightsTable.js     (TanStack Table)
│
├── stores/               # UI state only
│   └── weatherStore.js   (Zustand - for UI selection)
│
├── utils/
│   └── api.js            (Axios instance)
│
├── App.jsx               # TanStack Router setup
└── main.jsx              # React entry point
```

**Data Flow:**
1. **Data fetching** → TanStack Query hooks (automatic caching)
2. **Data display** → TanStack Table hooks (sorting, filtering, pagination)
3. **Forms** → TanStack Form hooks (validation, submission)
4. **Navigation** → TanStack Router (type-safe routes)
5. **UI state** → Zustand (lightweight, simple state)

---

## Data Sources & Scraping

### 8 Weather Sources

| # | Source | Type | Free | Reuse | Status |
|---|--------|------|------|-------|--------|
| 1 | **Open-Meteo** | API | ✅ Yes | ✅ Existing JS | Phase 2 |
| 2 | **WeatherAPI** | API | ✅ Limited | ✅ Existing JS | Phase 2 |
| 3 | **Meteoblue** | Scraper | ❌ No | ✅ Existing JS (Playwright) | Phase 2 |
| 4 | **Météo-parapente** | Feed/HTML | ✅ Yes | ✅ Existing JS | Phase 2 |
| 5 | **Météociel** | Scraper | ✅ Yes | ❌ New (Phase 2) | Phase 2 |
| 6 | **Parapente.net** | Scraper | ✅ Yes | ❌ New (Phase 4) | Phase 4 |
| 7 | **Windy** | API | ✅ Limited | ❌ New (Phase 4) | Phase 4 |
| 8 | **Planete-voile** | Scraper | ✅ Yes | ❌ New (Phase 4) | Phase 4 |

**Phase 2 Focus:** 5 sources (1-5)  
**Phase 4 Future:** Add 3-8

### Data Flow

```
Open-Meteo API → ┐
WeatherAPI API  → ├→ Normalize → De-duplicate → SQLite
Meteoblue HTML  → ├→ Validate  → Para-Index   ↓
Météo-parapente → ┤            Calculation   Dashboard
Météociel HTML  → ┘
                  
Every 30 minutes (APScheduler)
```

### Para-Index Calculation

**Composite 0-100 score** based on:

```python
def calculate_para_index(weather_data):
    score = 50  # Base
    
    # Wind (most critical)
    wind = weather_data['wind_speed_kmh']
    if wind < 3:
        score -= 40      # Vent insuffisant
    elif wind <= 8:
        score += 10
    elif wind <= 15:
        score += 40      # OPTIMAL
    elif wind <= 20:
        score -= 10
    else:
        score -= 50      # Trop fort
    
    # Cloud cover
    cloud = weather_data['cloud_cover_percent']
    if cloud > 80:
        score -= 30
    elif cloud < 20:
        score += 10
    
    # Temperature (thermals)
    temp = weather_data['temperature_c']
    if 12 <= temp <= 18:
        score += 15
    elif temp > 25:
        score -= 20
    
    # Gusts
    gusts = weather_data['wind_gust_kmh']
    if gusts > 25:
        score -= 50
    
    # Stability
    if weather_data.get('stability_index', 0) > 5:
        score += 10
    
    return max(0, min(100, score))
```

**Verdicts:**
- 🟢 **BON** (80-100) — Go fly!
- 🟡 **MOYEN** (50-79) — Possible with experience
- 🟠 **LIMITE** (30-49) — Risky, need skill
- 🔴 **MAUVAIS** (0-29) — Don't fly

---

## Code Reuse Strategy

### Existing Production Code

Your `generate-weather-report-v5.js` script is production-tested. We refactor it for the dashboard.

**Savings: 15-20 hours + 2 weeks timeline**

### Refactoring Plan (Phase 2, Week 2)

#### 1. OpenMeteoScraper (1.5 hours)

**Existing:** Working JS function with error handling, caching

**Refactor:**
```python
# backend/scrapers/openmeteo.py
from scripts.generate_weather_report_v5 import fetch_open_meteo

class OpenMeteoScraper:
    async def fetch(self, lat, lon):
        # REUSE existing function
        return fetch_open_meteo(lat, lon)
    
    def normalize(self, data):
        # Convert to DB schema
        return {
            'temperature_c': data['temperature_2m'],
            'wind_speed_kmh': data['wind_speed_10m'],
            'humidity_percent': data['relative_humidity_2m'],
            'cloud_cover_percent': data['cloud_cover'],
            # ... etc
        }
```

**Tests:** Use same recorded responses from JS script

#### 2. WeatherAPIScraper (1.25 hours)

**Existing:** Working API client with key management  
**Refactor:** Extract function → Python class + normalize wrapper

#### 3. MeteoblueScraper - Playwright (2.25 hours)

**Existing:** JS Playwright automation for hourly table extraction  
**Refactor:** Port exact same Playwright logic to Python

```python
# backend/scrapers/meteoblue.py
async def fetch(self, url: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        await page.goto(url)
        await page.wait_for_load_state("networkidle")
        
        # SAME CSS selectors as JS
        table = await page.query_selector(".forecast-table")
        rows = await table.query_selector_all("tr.hourly-row")
        
        # Extract 23 hours of data per day
        # ... parsing logic (SAME as JS)
```

#### 4. MeteoParapenteScraper (1.1 hours)

**Existing:** RSS feed + HTML parsing  
**Refactor:** Keep same logic, add DB insert

#### 5. Para-Index Calculation (0.75 hours)

**Existing:** Production-validated scoring algorithm  
**Refactor:** Copy line-by-line (don't improve!)

```python
# backend/scrapers/para_index.py
# COPY from JS script - this is production code!
```

### Test Data

Use **recorded responses** from your weather report script:

```python
# tests/fixtures/openmeteo-response.json
# Generated from generate-weather-report-v5.js
# Same data = confident refactoring
```

---

## Implementation Timeline

### Master Schedule

```
PHASE 1: Design               [NOW - FEB 26] ✅ COMPLETE
  ✓ Schema, API spec, frontend prototype, implementation plan

PHASE 2: Backend              [MAR 1 - MAR 28] ⏳ STARTING
  Week 1: Database + Python environment
  Week 2: Refactor 5 scrapers (existing code)
  Week 3: Pipeline + normalization
  Week 4: Scheduler + testing
  Effort: 20-30 hours

PHASE 3: Frontend             [MAR 28 - APR 25] ⏳ AFTER P2
  Week 1: FastAPI endpoints (50+)
  Week 2: Vue.js components (6 sections)
  Week 3: Deployment + monitoring
  Effort: 40-50 hours

POLISH & LAUNCH              [APR 25 - MAY 10]
  Final testing, documentation, go live

🚀 PRODUCTION LAUNCH: MAY 10, 2026 (2 weeks earlier than PostgreSQL version!)
```

### Effort Breakdown

| Phase | Duration | Effort | Vincent | Claw |
|-------|----------|--------|---------|------|
| Phase 1 | 1 week | 30 hrs | 10 hrs | 20 hrs (design) |
| Phase 2 | 4 weeks | 20-30 hrs | 25 hrs | 10 hrs async |
| Phase 3 | 4 weeks | 40-50 hrs | 40 hrs | 15 hrs async |
| **Total** | **9 weeks** | **70-80 hrs** | **75 hrs** | **45 hrs** |

**Per week:** ~4-5 hours for Vincent

---

## Phase 2: Backend (Detailed)

### Week 1: Database & Environment (4-5 hours)

**Goal:** SQLite ready, Python environment prepared

**Tasks:**

1. **Database Initialization** (1-2 hours)
   ```bash
   # From project root
   sqlite3 backend/db/dashboard.db < docs/PHASE-1-DESIGN/dashboard-schema-sqlite.sql
   
   # Verify
   sqlite3 backend/db/dashboard.db ".tables"
   sqlite3 backend/db/dashboard.db "SELECT COUNT(*) FROM sites;"  # Should be 3
   ```
   - ✅ All 12 tables created
   - ✅ Indexes optimized
   - ✅ Initial data loaded (3 sites, 8 weather sources)

2. **Python Environment** (2-3 hours)
   ```bash
   # Virtual environment
   python3 -m venv venv
   source venv/bin/activate
   
   # Install dependencies
   pip install -r backend/requirements.txt
   
   # Playwright browsers
   playwright install chromium
   
   # .env configuration
   cp backend/.env.example backend/.env
   # Edit: WEATHERAPI_KEY, STRAVA_KEY, API_PORT
   ```
   - ✅ venv created
   - ✅ All deps installed
   - ✅ Config ready

3. **Project Structure** (0.5 hours)
   - ✅ Already created in git
   - ✅ __init__.py files in place
   - ✅ Ready for code

**Definition of Done:**
```bash
# Database
sqlite3 backend/db/dashboard.db ".schema sites"  # Shows table

# Python
python -c "import fastapi; import sqlalchemy; print('OK')"

# Playwright
python -c "from playwright.async_api import async_playwright; print('OK')"
```

---

### Week 2: Refactor Weather Scrapers (5-7 hours)

**Goal:** 5 working scrapers ready to fetch real data

**This week REUSES existing JavaScript code from `generate-weather-report-v5.js`**

#### Scraper 1: Open-Meteo (1.5 hours)

**Existing code:** `fetch_open_meteo()` in generate-weather-report-v5.js (working production code)

**Create:** `backend/scrapers/openmeteo.py`

```python
import aiohttp
import asyncio

class OpenMeteoScraper:
    """Refactored from existing JS script"""
    
    def __init__(self):
        self.base_url = "https://api.open-meteo.com/v1/forecast"
    
    async def fetch(self, lat: float, lon: float):
        """Fetch 7-day hourly forecast (SAME as JS)"""
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": [
                "temperature_2m", "relative_humidity_2m",
                "weather_code", "wind_speed_10m",
                "wind_direction_10m", "wind_gusts_10m",
                "cloud_cover", "visibility", "uv_index"
            ],
            "daily": ["precipitation_sum", "wind_speed_10m_max"],
            "timezone": "Europe/Paris",
            "forecast_days": 7
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(self.base_url, params=params) as resp:
                return await resp.json()
    
    def normalize(self, raw_data: dict) -> list:
        """Convert to database format"""
        forecasts = []
        hourly = raw_data['hourly']
        
        for i, time_str in enumerate(hourly['time']):
            forecasts.append({
                'forecast_date': time_str.split('T')[0],
                'forecast_time': time_str.split('T')[1],
                'temperature_c': hourly['temperature_2m'][i],
                'humidity_percent': hourly['relative_humidity_2m'][i],
                'wind_speed_kmh': hourly['wind_speed_10m'][i],
                'wind_direction_deg': hourly['wind_direction_10m'][i],
                'wind_gust_kmh': hourly['wind_gusts_10m'][i],
                'cloud_cover_percent': hourly['cloud_cover'][i],
                'visibility_km': hourly['visibility'][i],
                'uv_index': hourly['uv_index'][i],
                'source_id': 'src-001',  # Open-Meteo
            })
        
        return forecasts
```

**Tests:** `backend/tests/test_openmeteo.py`

```python
import pytest
from scrapers.openmeteo import OpenMeteoScraper

@pytest.mark.asyncio
async def test_openmeteo_fetch():
    scraper = OpenMeteoScraper()
    
    # Use RECORDED response from JS script
    with open('tests/fixtures/openmeteo-response.json') as f:
        response = json.load(f)
    
    # Normalize
    normalized = scraper.normalize(response)
    
    # Assertions
    assert len(normalized) == 7 * 24  # 7 days, 24 hours
    assert normalized[0]['temperature_c'] > -50
    assert normalized[0]['wind_speed_kmh'] >= 0
```

**Deliverables:**
- ✅ `openmeteo.py` with fetch + normalize
- ✅ Unit tests passing
- ✅ Can fetch real data from API

---

#### Scraper 2: WeatherAPI (1.25 hours)

**Existing:** `fetch_weatherapi()` in JS script  
**File:** `backend/scrapers/weatherapi.py`

```python
class WeatherAPIScraper:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.weatherapi.com/v1/forecast.json"
    
    async def fetch(self, lat: float, lon: float):
        params = {
            "key": self.api_key,
            "q": f"{lat},{lon}",
            "days": 7,
            "aqi": "yes"
        }
        async with aiohttp.ClientSession() as session:
            async with session.get(self.base_url, params=params) as resp:
                return await resp.json()
    
    def normalize(self, raw_data: dict) -> list:
        # Similar structure, different API format
        # Convert forecast days to hourly records
        # Return list of forecast dicts
```

**Tests:** Same pattern as OpenMeteo

---

#### Scraper 3: Meteoblue (2.25 hours) - CRITICAL

**Existing:** Playwright automation in JS script (production code)  
**File:** `backend/scrapers/meteoblue.py`

This is the most complex - it uses **Playwright to extract hourly table data**.

```python
from playwright.async_api import async_playwright

class MeteoblueScraper:
    async def fetch(self, url: str) -> dict:
        """
        Open Meteoblue forecast page, extract hourly table
        (SAME Playwright logic as JS script)
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Navigate and wait for content
            await page.goto(url, wait_until="networkidle")
            
            # Extract table (SAME selectors as JS)
            table_selector = "table.forecast-table"
            rows_selector = "tr.hourly-row"
            
            table = await page.query_selector(table_selector)
            if not table:
                raise ValueError("Could not find forecast table")
            
            rows = await table.query_selector_all(rows_selector)
            
            forecasts = []
            for row in rows:
                cells = await row.query_selector_all("td")
                
                # Extract each column (SAME parsing as JS)
                forecast = {
                    'time': await cells[0].text_content(),
                    'temperature': float(await cells[1].text_content()),
                    'wind': float(await cells[2].text_content()),
                    'gust': float(await cells[3].text_content()),
                    'cloud': int(await cells[4].text_content()),
                    'precip': float(await cells[5].text_content()),
                    # ... etc (23 columns per hour)
                }
                forecasts.append(forecast)
            
            await browser.close()
            return forecasts
    
    def normalize(self, raw_data: list) -> list:
        # Convert Meteoblue format to database format
```

**Tests:** Record HTML snapshot, test against it

---

#### Scraper 4: Météo-parapente (1.1 hours)

**Existing:** RSS feed parser in JS script  
**File:** `backend/scrapers/meteo_parapente.py`

```python
import feedparser

class MeteoParapenteScraper:
    async def fetch(self) -> dict:
        # Fetch RSS feed
        feed = feedparser.parse("https://www.meteo-parapente.com/rss.php")
        
        entries = []
        for entry in feed.entries:
            entries.append({
                'title': entry.title,
                'summary': entry.summary,
                'published': entry.published,
            })
        
        return {'entries': entries}
    
    def normalize(self, raw_data: dict) -> list:
        # Extract: thermal_strength, stability_index from summary
        # Return forecast list
```

**Tests:** Mock RSS feed, test parsing

---

#### Scraper 5: Météociel (1.5 hours)

**New:** Not in existing JS script  
**File:** `backend/scrapers/meteorueil.py`

Similar to Meteoblue - use BeautifulSoup or Playwright to scrape forecast table.

---

#### Para-Index Calculation (0.75 hours)

**File:** `backend/scrapers/para_index.py`

**CRITICAL:** Copy the algorithm from JS **line-by-line**. Don't improve it!

```python
def calculate_para_index(weather: dict) -> int:
    """
    Production-validated scoring algorithm
    (Copied directly from JS script - DO NOT MODIFY)
    """
    score = 50
    
    wind = weather['wind_speed_kmh']
    if wind < 3:
        score -= 40
    elif wind <= 8:
        score += 10
    # ... rest exactly as in JS
    
    return max(0, min(100, score))
```

**Tests:** Verify against known conditions from weather report script

---

**Definition of Done (Week 2):**
```bash
# All scrapers can fetch data
python -c "
import asyncio
from scrapers.openmeteo import OpenMeteoScraper
s = OpenMeteoScraper()
data = asyncio.run(s.fetch(47.22, 6.01))
print(f'Got {len(data[\"hourly\"][\"time\"])} hours of data')
"

# All tests pass
pytest backend/tests/test_scrapers.py -v

# Para-index calculation works
python -c "
from scrapers.para_index import calculate_para_index
score = calculate_para_index({'wind_speed_kmh': 12, 'cloud_cover_percent': 30})
assert 60 <= score <= 80, f'Expected ~70, got {score}'
print(f'Para-index: {score}')
"
```

---

### Week 3: Pipeline & Normalization (10-12 hours)

**Goal:** Data flows from scrapers → normalized → database

**Tasks:**

1. **Data Normalization Layer** (3-4 hours)

```python
# backend/pipeline/normalize.py

class DataNormalizer:
    """Convert all sources to standard schema"""
    
    @staticmethod
    def normalize_forecast(raw_data, source_id, site_id):
        """Raw data → database format"""
        
        normalized = {
            'site_id': site_id,
            'source_id': source_id,
            'forecast_date': parse_date(raw_data),
            'forecast_time': parse_time(raw_data),
            
            # All in standard units
            'temperature_c': raw_data['temp_celsius'],
            'wind_speed_kmh': raw_data['wind_kmh'],
            'humidity_percent': raw_data['humidity'],
            'cloud_cover_percent': raw_data['cloud'],
            
            # Calculated
            'para_index': calculate_para_index(raw_data),
            'verdict': verdict_from_index(raw_data),
        }
        
        return normalized
    
    @staticmethod
    def validate(data):
        """Check for invalid values"""
        
        # Temperature: -50 to 50°C
        assert -50 <= data['temperature_c'] <= 50
        
        # Wind: 0 to 100 km/h
        assert 0 <= data['wind_speed_kmh'] <= 100
        
        # Humidity: 0 to 100%
        assert 0 <= data['humidity_percent'] <= 100
        
        # Cloud: 0 to 100%
        assert 0 <= data['cloud_cover_percent'] <= 100
        
        return True
```

2. **Pipeline Orchestration** (3-4 hours)

```python
# backend/pipeline/pipeline.py

from scrapers.openmeteo import OpenMeteoScraper
from scrapers.weatherapi import WeatherAPIScraper
from scrapers.meteoblue import MeteoblueScraper
from scrapers.meteo_parapente import MeteoParapenteScraper
from pipeline.normalize import DataNormalizer
from db.models import WeatherForecast

class WeatherPipeline:
    def __init__(self):
        self.scrapers = {
            'open-meteo': OpenMeteoScraper(),
            'weatherapi': WeatherAPIScraper(api_key=os.getenv('WEATHERAPI_KEY')),
            'meteoblue': MeteoblueScraper(),
            'meteo-parapente': MeteoParapenteScraper(),
            'meteorueil': MeteocielScraper(),
        }
        self.normalizer = DataNormalizer()
    
    async def process(self, site_id: str, site_lat: float, site_lon: float):
        """
        Fetch from all sources, normalize, insert to DB
        """
        
        all_forecasts = []
        errors = []
        
        # Fetch concurrently from all sources
        tasks = [
            self.scrapers['open-meteo'].fetch(site_lat, site_lon),
            self.scrapers['weatherapi'].fetch(site_lat, site_lon),
            self.scrapers['meteoblue'].fetch(url=...),
            self.scrapers['meteo-parapente'].fetch(),
            self.scrapers['meteorueil'].fetch(),
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process each source
        for scraper_name, raw_data in zip(self.scrapers.keys(), results):
            if isinstance(raw_data, Exception):
                errors.append((scraper_name, str(raw_data)))
                continue
            
            try:
                # Get scraper's normalize method
                scraper = self.scrapers[scraper_name]
                normalized = scraper.normalize(raw_data)
                
                # Validate each forecast
                for forecast in normalized:
                    try:
                        self.normalizer.validate(forecast)
                        forecast['site_id'] = site_id
                        forecast['source_id'] = get_source_id(scraper_name)
                        all_forecasts.append(forecast)
                    except AssertionError as e:
                        errors.append((scraper_name, f"Validation: {str(e)}"))
            
            except Exception as e:
                errors.append((scraper_name, str(e)))
        
        # Insert to database (batch)
        if all_forecasts:
            db.weather_forecasts.insert_many(all_forecasts)
        
        # Log errors (don't fail if one source is down)
        if errors:
            logger.warning(f"Scraper errors: {errors}")
        
        return {
            'inserted': len(all_forecasts),
            'errors': errors,
        }
    
    async def process_all_sites(self):
        """Process all 3 sites"""
        sites = [
            ('site-001', 47.22356, 6.01842),  # Arguel
            ('site-002', 47.16425, 5.99234),  # Mont Poupet
            ('site-003', 47.18956, 6.04567),  # La Côte
        ]
        
        for site_id, lat, lon in sites:
            await self.process(site_id, lat, lon)
```

3. **Database Models** (2-3 hours)

```python
# backend/db/models.py

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Site(Base):
    __tablename__ = "sites"
    
    id = Column(String, primary_key=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    elevation_m = Column(Integer)
    latitude = Column(Float)
    longitude = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

class WeatherForecast(Base):
    __tablename__ = "weather_forecasts"
    
    id = Column(String, primary_key=True)
    site_id = Column(String, ForeignKey("sites.id"))
    source_id = Column(String, ForeignKey("weather_sources.id"))
    forecast_date = Column(String)
    temperature_c = Column(Float)
    wind_speed_kmh = Column(Float)
    # ... etc (all columns)
    para_index = Column(Integer)
    verdict = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# Similar for Flight, Alert, etc.
```

4. **Error Handling & Resilience** (2-3 hours)

```python
from tenacity import retry, stop_after_attempt, wait_exponential

class ResilientPipeline(WeatherPipeline):
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def fetch_with_retry(self, scraper_name):
        """Retry failed requests"""
        return await self.scrapers[scraper_name].fetch()
    
    async def process_all_sites(self):
        """
        Process all sites even if one fails
        Report errors separately
        """
        # ... implementation
```

**Definition of Done (Week 3):**
```bash
# Pipeline test
python -c "
import asyncio
from pipeline.pipeline import WeatherPipeline

pipeline = WeatherPipeline()
result = asyncio.run(pipeline.process('site-001', 47.22356, 6.01842))
print(f'Inserted {result[\"inserted\"]} forecasts')
assert result['inserted'] > 100, 'Should have hourly data'
"

# Database verification
sqlite3 backend/db/dashboard.db "SELECT COUNT(*) FROM weather_forecasts;"
# Should be 100+ records

# Verify data quality
sqlite3 backend/db/dashboard.db "
SELECT 
  source_id,
  COUNT(*) as count,
  MIN(temperature_c) as min_temp,
  MAX(temperature_c) as max_temp,
  AVG(wind_speed_kmh) as avg_wind
FROM weather_forecasts
GROUP BY source_id;
"
# Should show all 5 sources with reasonable ranges
```

---

### Week 4: Scheduler & Testing (12-15 hours)

**Goal:** Automated data collection running 24/7, full test coverage

**Tasks:**

1. **APScheduler Integration** (3-4 hours)

```python
# backend/scheduler/scheduler.py

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from pipeline.pipeline import WeatherPipeline
from api.app import app  # FastAPI instance

scheduler = AsyncIOScheduler()
pipeline = WeatherPipeline()

def setup_scheduler():
    """Configure all scheduled jobs"""
    
    # Every 30 minutes: fetch weather from all sources
    scheduler.add_job(
        pipeline.process_all_sites,
        trigger=IntervalTrigger(minutes=30),
        id='fetch_weather',
        name='Fetch weather from all sources',
        max_instances=1,  # Don't overlap
        coalesce=True,    # Skip missed runs
    )
    
    # Every 5 minutes: check alert triggers
    scheduler.add_job(
        check_alert_triggers,
        trigger=IntervalTrigger(minutes=5),
        id='check_alerts',
        name='Check alert thresholds',
    )
    
    # Daily: Strava flight sync
    scheduler.add_job(
        sync_strava_flights,
        trigger=CronTrigger(hour=6, minute=0),  # 6 AM
        id='sync_strava',
        name='Sync flights from Strava',
    )
    
    # Daily: Cleanup old data (>30 days)
    scheduler.add_job(
        cleanup_old_data,
        trigger=CronTrigger(hour=2, minute=0),  # 2 AM
        id='cleanup',
        name='Clean up old forecasts',
    )
    
    scheduler.start()
    return scheduler

def start_scheduler():
    """Start in background (for FastAPI on startup)"""
    scheduler = setup_scheduler()
    logger.info("Scheduler started with 4 jobs")
```

2. **Strava Flight Sync** (3-4 hours)

```python
# backend/scheduler/strava.py

class StravaScraper:
    def __init__(self, api_key: str):
        self.client = StravaClient(api_key)
    
    async def sync_flights(self):
        """Fetch new/updated activities from Strava"""
        
        # Get athlete's activities since last sync
        activities = await self.client.get_athlete_activities(
            after=last_sync_time
        )
        
        for activity in activities:
            # Only flights (paragliding activity type)
            if activity.activity_type != 'paragliding':
                continue
            
            # Match to site (by location)
            site = self.match_site(activity.latitude, activity.longitude)
            if not site:
                logger.warning(f"Could not match site for: {activity.name}")
                continue
            
            # Create flight record
            flight = {
                'strava_id': activity.id,
                'site_id': site.id,
                'title': activity.name,
                'flight_date': activity.start_date,
                'duration_minutes': activity.moving_time / 60,
                'max_altitude_m': activity.elevation_gain,  # Approximate
                'distance_km': activity.distance / 1000,
                'imported_from': 'strava',
            }
            
            # Insert or update
            db.flights.upsert(flight, strava_id=activity.id)
        
        logger.info(f"Synced {len(activities)} activities from Strava")
```

3. **Testing Suite** (4-6 hours)

```bash
# Unit tests
pytest backend/tests/test_scrapers.py -v
pytest backend/tests/test_pipeline.py -v
pytest backend/tests/test_scheduler.py -v
pytest backend/tests/test_api.py -v

# Coverage
pytest backend/tests/ --cov=backend --cov-report=html
# Target: >80% coverage

# Integration test (full pipeline)
pytest backend/tests/test_integration.py -v
# Fetches real data, inserts to test DB, validates
```

**Example test:**

```python
# backend/tests/test_pipeline.py

import pytest
import asyncio
import json
from pipeline.pipeline import WeatherPipeline

@pytest.fixture
def pipeline():
    return WeatherPipeline()

@pytest.mark.asyncio
async def test_full_pipeline(pipeline, tmp_path):
    """Full pipeline: fetch → normalize → insert"""
    
    # Use recorded response (from JS script)
    with open('tests/fixtures/openmeteo-response.json') as f:
        mock_response = json.load(f)
    
    # Mock the scraper
    with patch.object(
        pipeline.scrapers['open-meteo'],
        'fetch',
        return_value=mock_response
    ):
        # Run pipeline
        result = await pipeline.process('site-001', 47.22, 6.01)
    
    # Verify
    assert result['inserted'] > 100
    assert len(result['errors']) == 0  # No errors on mocked data
    
    # Check database
    forecasts = db.weather_forecasts.find(site_id='site-001')
    assert len(forecasts) > 100
    
    # Verify para-index calculated
    for forecast in forecasts[:10]:
        assert 0 <= forecast['para_index'] <= 100
```

4. **Documentation** (2-3 hours)

- Backend README updated with setup + architecture
- API endpoint documentation (auto-generated by Swagger)
- Troubleshooting guide
- Deployment instructions

**Definition of Done (Week 4):**
```bash
# Scheduler runs successfully
python -c "
from scheduler.scheduler import setup_scheduler
s = setup_scheduler()
print(f'Scheduled {len(s.get_jobs())} jobs')
for job in s.get_jobs():
    print(f'  - {job.name}: {job.trigger}')
"

# All tests pass with coverage >80%
pytest backend/tests/ --cov=backend -v
# Coverage: 85% (target achieved)

# Database has 7+ days of data for all sites/sources
sqlite3 backend/db/dashboard.db "
SELECT 
  DATE(forecast_date),
  COUNT(DISTINCT source_id) as sources,
  COUNT(*) as records
FROM weather_forecasts
GROUP BY DATE(forecast_date)
ORDER BY DATE(forecast_date) DESC
LIMIT 7;
"
# Should show 7 days with 5 sources each

# Strava flights imported
sqlite3 backend/db/dashboard.db "SELECT COUNT(*) FROM flights;"
# Should show flights from Strava

# API running and responding
python -m uvicorn api.app:app &
sleep 2
curl http://localhost:8000/api/v1/sites
# Should return JSON array of 3 sites
```

---

## Phase 3: Frontend (Detailed)

**Duration:** 4 weeks (March 28 - April 25)  
**Effort:** 40-50 hours (~6 hrs/week for Vincent)

### Week 1: REST API Development (8-10 hours)

**Goal:** 50+ endpoints working with full documentation

**Technology:** FastAPI (auto-documentation)

### Week 2: React Components with TanStack (10-12 hours)

**Goal:** All 6 dashboard sections functional with TanStack tools

```jsx
// Example: Dashboard with TanStack Query + Router
import { useCurrentConditions, useSites } from '../hooks/useWeather'
import { useFlightsTable } from '../hooks/useFlightsTable'
import { useNavigate } from '@tanstack/react-router'

export function Dashboard() {
  const navigate = useNavigate()
  
  // Data fetching with automatic caching
  const { data: sites, isLoading } = useSites()
  const { data: conditions } = useCurrentConditions()
  
  if (isLoading) return <div>Loading...</div>
  
  return (
    <div className="dashboard">
      <CurrentConditions data={conditions} />
      <Forecast7Day />
      <RecentFlights />
      <LearningStats />
      <AlertManager />
      <SourceComparison />
    </div>
  )
}

// Example: Flights table with TanStack Table
export function FlightsList() {
  const { table, isLoading } = useFlightsTable()
  
  return (
    <div>
      <table>
        {/* TanStack Table renders here */}
      </table>
      <div className="pagination">
        <button onClick={() => table.previousPage()}>Previous</button>
        <span>Page {table.getState().pagination.pageIndex + 1}</span>
        <button onClick={() => table.nextPage()}>Next</button>
      </div>
    </div>
  )
}

// Example: Alert form with TanStack Form
export function AlertForm({ alertId }) {
  const { form, isLoading } = useAlertForm()
  
  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <form.Field name="name">
        {(field) => (
          <input
            value={field.state.value}
            onChange={(e) => field.setValue(e.target.value)}
          />
        )}
      </form.Field>
      <button type="submit" disabled={isLoading}>Save</button>
    </form>
  )
}
```

**Components to implement:**
- **CurrentConditions** — 3 site cards with para-index
  - Uses: `useCurrentConditions` (TanStack Query)
  
- **Forecast7Day** — Timeline of best flying days
  - Uses: `useForecast` (TanStack Query)
  
- **RecentFlights** — List with sorting, filtering, pagination
  - Uses: `useFlightsTable` (TanStack Table) + `useFlights` (TanStack Query)
  
- **LearningStats** — Charts and metrics
  - Uses: `useFlightStats`, `useSiteStats` (TanStack Query)
  
- **AlertManager** — Create/edit/delete alerts
  - Uses: `useAlerts`, `useCreateAlert`, `useUpdateAlert` (TanStack Query + Mutations)
  - Uses: `useAlertForm` (TanStack Form)
  
- **SourceComparison** — Data accuracy comparison table
  - Uses: `useWeatherSourcesTable` (TanStack Table)
  - Uses: `useWeatherSources` (TanStack Query)
  
- **Navigation** — Header with routing
  - Uses: `useNavigate` (TanStack Router)

### Week 3: Deployment & Polish (10-12 hours)

**Goal:** Production-ready build, Docker setup, monitoring

---

## Infrastructure & Setup

### Deployment Architecture

```
┌─────────────────────────────────────┐
│      Proxmox/OpenClaw Host          │
├─────────────────────────────────────┤
│                                     │
│  /home/capic/.openclaw/workspace/   │
│  paragliding/dashboard/             │
│  ├── backend/                       │
│  │   ├── db/dashboard.db (SQLite)   │
│  │   ├── scrapers/                  │
│  │   ├── api/                       │
│  │   └── venv/                      │
│  │                                   │
│  ├── frontend/dist/  (Built Vue)    │
│  └── nginx.conf      (Reverse proxy)│
│                                     │
│  Services:                          │
│  • Uvicorn (API) :8000              │
│  • Nginx (Web) :443                 │
│  • APScheduler (Background)         │
│                                     │
└─────────────────────────────────────┘
```

### Local Setup (Phase 2 Week 1)

```bash
# 1. Clone repo (or navigate to existing)
cd /home/capic/.openclaw/workspace/paragliding/dashboard

# 2. Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with keys

# Initialize database
sqlite3 db/dashboard.db < ../docs/PHASE-1-DESIGN/dashboard-schema-sqlite.sql

# 3. Frontend setup
cd ../frontend
npm install

# 4. Test everything
# Terminal 1: Backend API
cd backend && source venv/bin/activate && python -m uvicorn api.app:app --reload

# Terminal 2: Frontend dev
cd frontend && npm run dev

# Terminal 3: Scheduler (optional, for testing)
cd backend && python -m scheduler.scheduler
```

### Production Deployment (Phase 3 Week 3)

```bash
# 1. Build frontend
cd frontend
npm run build
# Output: dist/

# 2. Configure Nginx
sudo cp infrastructure/nginx.conf /etc/nginx/sites-available/dashboard
sudo ln -s /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 3. Start API (systemd)
sudo cp infrastructure/dashboard-api.service /etc/systemd/system/
sudo systemctl enable dashboard-api
sudo systemctl start dashboard-api

# 4. Start Scheduler
# (Can run in separate terminal or systemd service)

# 5. Monitor
tail -f backend/logs/dashboard.log
```

---

## Risk Management

### Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Scraper HTML changes** | Medium | High | Monitor + quick fixes + fallback sources |
| **API rate limiting** | Medium | Medium | Caching (30-60 min TTL) + stagger requests |
| **Database performance** | Low | High | Proper indexing + query optimization |
| **Strava API breaks** | Low | Low | Graceful degradation + manual entry option |
| **Weather data accuracy** | Medium | Medium | Multi-source consensus + validation |
| **Vincent unavailable** | Medium | Medium | Async work + documentation + tests |

### Mitigation Strategies

1. **Scraper Robustness:** Keep 5+ sources, monitor changes daily
2. **Rate Limiting:** Cache responses, implement request queuing
3. **Database:** Index optimization, archive old data (>90 days)
4. **Continuity:** Full documentation, automated tests, CI/CD

---

## Success Criteria

### Go/No-Go Gates

**Phase 2 Gate (End of March 28):**
- ✅ Database initialized with 5 sources working
- ✅ 7+ days of data for all sites
- ✅ Test coverage >80%
- ✅ Scheduler running 24+ hours without error
- ✅ Strava flights synced

**Phase 3 Gate (End of April 25):**
- ✅ All 50+ API endpoints working (<200ms response)
- ✅ All UI sections implemented & responsive
- ✅ End-to-end tests passing
- ✅ Docker build successful
- ✅ Lighthouse score >90

### Feature-Level Success

- ✅ Dashboard displays real-time conditions from 5 sources
- ✅ Para-index unified score displayed prominently
- ✅ 7-day forecast with best flying days highlighted
- ✅ Flight history synced from Strava
- ✅ Learning statistics calculated correctly
- ✅ Alerts trigger properly (Telegram notification)
- ✅ Source comparison shows data consistency
- ✅ Page loads in <2 seconds
- ✅ Mobile responsive
- ✅ HTTPS enforced

---

## Appendices

### A. Technology Justifications

**Why SQLite (not PostgreSQL)?**
- ✅ Single file = easy backup
- ✅ Zero infrastructure setup
- ✅ Perfect for single-user dashboard
- ✅ Can migrate to PostgreSQL later (SQLAlchemy ORM)
- ✅ Saves 20 hours setup time

**Why FastAPI (not Flask)?**
- ✅ Async/await built-in (better for I/O)
- ✅ Auto-documentation (Swagger UI)
- ✅ Type hints + validation (Pydantic)
- ✅ Modern Python 3.10+ features

**Why React + TanStack Suite?**
- ✅ Larger ecosystem & community
- ✅ More job market value
- ✅ TanStack tools are industry-leading for specific problems:
  - **TanStack Query** — Best data fetching library
  - **TanStack Router** — Modern type-safe routing
  - **TanStack Table** — Most flexible headless table
  - **TanStack Form** — Enterprise-grade form handling
- ✅ Zustand for lightweight UI state
- ✅ Perfect for complex dashboards with rich interactions

### B. Code Organization

**Backend structure:**
```
backend/
├── scrapers/       # Data fetchers (refactored from JS)
├── pipeline/       # Normalization & orchestration
├── scheduler/      # APScheduler + background jobs
├── api/            # FastAPI routes & endpoints
├── db/             # SQLite database + models
├── tests/          # Unit & integration tests
└── logs/           # Application logs
```

**Frontend structure:**
```
frontend/
├── src/
│   ├── components/  # Reusable Vue components
│   ├── views/       # Page-level components
│   ├── stores/      # Pinia state management
│   └── main.js      # Vue app initialization
└── public/          # Static assets
```

### C. Deployment Checklist

- [ ] Environment variables configured (.env)
- [ ] SQLite database initialized
- [ ] Python dependencies installed
- [ ] Frontend built (npm run build)
- [ ] API server tested (http://localhost:8000/docs)
- [ ] Nginx configured & tested
- [ ] HTTPS certificates installed
- [ ] Scheduler running in background
- [ ] Logs being written properly
- [ ] Database backups scheduled (daily)
- [ ] Monitoring alerts configured
- [ ] Documentation complete

### D. Communication & Team Process

**Weekly syncs:** Monday 10:00 GMT+1  
**Async updates:** Telegram chat  
**Code reviews:** GitHub pull requests  
**Issues:** GitHub Issues tracker

**Key principle:** "Don't block each other"
- Vincent works on implementation
- Claw handles async coding tasks
- Tests run automatically
- Failures caught early

### E. Resource Links

- **[FastAPI Docs](https://fastapi.tiangolo.com/)** — API framework
- **[SQLAlchemy ORM](https://docs.sqlalchemy.org/)** — Database
- **[Vue 3 Guide](https://vuejs.org/guide/)** — Frontend
- **[Playwright](https://playwright.dev/)** — Web scraping
- **[APScheduler](https://apscheduler.readthedocs.io/)** — Scheduling

---

## Summary

**The Dashboard Parapente project is fully specified and ready to build.**

- ✅ Database schema (SQLite, 12 tables)
- ✅ API specification (50+ endpoints)
- ✅ Frontend architecture (6 sections, responsive)
- ✅ Scraping strategy (8 sources, refactoring existing code)
- ✅ Implementation timeline (3 phases, 9 weeks)
- ✅ Code reuse plan (saves 15-20 hours)
- ✅ Risk mitigation strategies
- ✅ Success criteria (clear gates)

**Next steps:**
1. Vincent reviews & provides feedback (if any)
2. Phase 2 begins March 1, 2026
3. Weekly syncs + async support from Claw
4. Launch May 10, 2026 🚀

---

**Document Status:** Complete & Ready for Implementation  
**Last Updated:** 2026-02-26 15:00 GMT+1  
**Author:** Claw  
**Project Owner:** Vincent CAPICOTTO
