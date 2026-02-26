# Backend - Dashboard Parapente

Python backend for weather data collection, normalization, and API serving.

---

## 🏗️ Structure

```
backend/
├── scrapers/          # Weather data source clients (refactored from existing code)
├── pipeline/          # Data orchestration & normalization
├── scheduler/         # APScheduler job management
├── api/               # FastAPI application & REST endpoints
├── tests/             # Unit & integration tests
├── db/                # SQLite database & migrations
├── requirements.txt   # Python dependencies
├── .env.example       # Environment variables template
└── README.md          # THIS FILE
```

---

## 🚀 Setup (Phase 2, Week 1)

### 1. Database Initialization (2 minutes)

```bash
# Create database directory
mkdir -p db/backups

# Initialize SQLite from schema
sqlite3 db/dashboard.db < ../docs/PHASE-1-DESIGN/dashboard-schema-sqlite.sql

# Verify
sqlite3 db/dashboard.db ".tables"
# Output: sites, flights, weather_sources, weather_forecasts, alerts, ...
```

### 2. Python Environment

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download Playwright browsers
playwright install chromium
```

### 3. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your actual values
# - WEATHERAPI_KEY
# - STRAVA_KEY
# - API_PORT (default 8000)
```

### 4. Test Database Connection

```bash
python
>>> import sqlite3
>>> conn = sqlite3.connect('db/dashboard.db')
>>> cursor = conn.cursor()
>>> cursor.execute("SELECT COUNT(*) FROM sites")
>>> print(cursor.fetchone())
(3,)  # Should show 3 sites (Arguel, Mont Poupet, La Côte)
>>> conn.close()
```

---

## 📦 Scrapers (Phase 2, Week 2)

Refactoring existing production code from `generate-weather-report-v5.js`.

### Available Scrapers

1. **OpenMeteoScraper** ✅ REUSE
   - API: `https://api.open-meteo.com/v1/forecast`
   - Data: Hourly forecasts (temp, wind, humidity, cloud, etc.)
   - Refactor time: ~1.5 hours

2. **WeatherAPIScraper** ✅ REUSE
   - API: `https://api.weatherapi.com/v1/forecast.json`
   - Requires: API key (free tier available)
   - Refactor time: ~1.25 hours

3. **MeteoblueScraper** ✅ REUSE (Playwright)
   - URL: Meteoblue forecast page
   - Method: Playwright headless browser
   - Data: Hourly table with ensemble models
   - Refactor time: ~2.25 hours

4. **MeteoParapenteScraper** ✅ REUSE
   - Feed: RSS + HTML fallback
   - Data: Thermal index, stability index
   - Refactor time: ~1.1 hours

5. **ParaIndexCalculation** ✅ REUSE
   - Scoring: 0-100 composite score
   - Factors: Wind, cloud, temperature, thermals, stability
   - Production-validated algorithm
   - Refactor time: ~0.75 hours

### Example: Using a Scraper

```python
from scrapers.openmeteo import OpenMeteoScraper

# Initialize
scraper = OpenMeteoScraper()

# Fetch data
data = await scraper.fetch(latitude=47.22356, longitude=6.01842)

# Normalize for database
normalized = scraper.normalize(data)

# Insert to database
db.weather_forecasts.insert_many(normalized)
```

---

## 🔄 Pipeline (Phase 2, Week 3)

Data orchestration and normalization.

```python
from pipeline.pipeline import WeatherPipeline
from db.models import Site

pipeline = WeatherPipeline()

# Process all sites
for site in Site.all():
    await pipeline.process(site_id=site.id)
    # Fetches from all 5 sources concurrently
    # Normalizes data
    # Inserts to SQLite
```

---

## ⏰ Scheduler (Phase 2, Week 4)

APScheduler integration for automated data collection.

```python
from scheduler.scheduler import start_scheduler

# Start scheduler (runs in background)
start_scheduler()

# Jobs run automatically:
# - Weather collection: every 30 min
# - Alert checks: every 5 min
# - Data cleanup: daily
```

---

## 🔌 API (Phase 3, Week 1)

FastAPI REST server with 50+ endpoints.

### Start API Server (Development)

```bash
# Terminal 1: Start API
python -m uvicorn api.app:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: View API docs
open http://localhost:8000/docs  # Swagger UI
open http://localhost:8000/redoc # ReDoc

# Test endpoint
curl http://localhost:8000/api/v1/sites
```

### Key Endpoints

- `GET /api/v1/sites` — List flying sites
- `GET /api/v1/weather/current` — Latest conditions
- `GET /api/v1/weather/forecast/{site_id}` — 7-day forecast
- `GET /api/v1/flights` — Flight history
- `POST /api/v1/alerts` — Create alert
- `GET /api/v1/stats` — Learning statistics

See [API Spec](../docs/PHASE-1-DESIGN/dashboard-api-spec.md) for complete documentation.

---

## 🧪 Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ -v --cov=scrapers,pipeline,api --cov-report=html

# Run specific test file
pytest tests/test_scrapers.py -v

# Run specific test
pytest tests/test_scrapers.py::test_openmeteo_fetch -v
```

### Test Data

Uses real recorded responses from production:

```python
# tests/fixtures/openmeteo-response.json
# Generated from: generate-weather-report-v5.js
# Same data used in existing weather reports
```

---

## 📊 Database

### SQLite Schema

12 tables:
- `sites` — Flying locations (Arguel, Mont Poupet, La Côte)
- `weather_forecasts` — Hourly forecasts from all sources
- `weather_sources` — Source providers (Open-Meteo, WeatherAPI, etc.)
- `flights` — Flight history (synced from Strava)
- `alerts` — User-defined alert rules
- `alert_triggers` — Alert history
- `flight_statistics` — Aggregated stats per site/period
- `scraper_health` — Data source health tracking
- Plus views for common queries

### Inspect Database

```bash
# Connect to SQLite
sqlite3 db/dashboard.db

# List tables
.tables

# View schema
.schema sites

# Query data
SELECT COUNT(*) FROM weather_forecasts;
SELECT * FROM sites;

# Exit
.quit
```

### Backup Strategy

```bash
# Daily backup (cron job)
cp db/dashboard.db db/backups/dashboard-$(date +%Y%m%d).db

# Keep last 30 backups
find db/backups -name "*.db" -type f -mtime +30 -delete

# Recovery
cp db/backups/dashboard-20260315.db db/dashboard.db
```

---

## 📝 Logging

Logs are written to `logs/dashboard.log` and console.

```python
import logging
logger = logging.getLogger(__name__)

logger.info("Processing site: Arguel")
logger.error("Failed to fetch from WeatherAPI", exc_info=True)
```

---

## 🐛 Common Issues

### Issue: "database.db not found"
```bash
# Check location
ls -la db/dashboard.db

# Reinitialize if missing
sqlite3 db/dashboard.db < ../docs/PHASE-1-DESIGN/dashboard-schema-sqlite.sql
```

### Issue: "ImportError: No module named 'sqlalchemy'"
```bash
# Activate venv and install requirements
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: "Playwright browser not found"
```bash
# Install Chromium
playwright install chromium
```

---

## 📚 Documentation

- **[Implementation Plan](../docs/PHASE-1-DESIGN/dashboard-implementation-plan.md)** — Week-by-week breakdown
- **[Code Reuse Plan](../docs/PHASE-1-DESIGN/CODE-REUSE-PLAN.md)** — How we reuse existing code
- **[API Spec](../docs/PHASE-1-DESIGN/dashboard-api-spec.md)** — All endpoints & formats
- **[Database Schema](../docs/PHASE-1-DESIGN/dashboard-schema-sqlite.sql)** — SQL schema

---

## ✅ Phase 2 Checklist

- [ ] Week 1: Database setup + Python environment
- [ ] Week 2: Refactor 5 scrapers + normalize wrappers
- [ ] Week 3: Pipeline orchestration + database insertion
- [ ] Week 4: Scheduler + Strava sync + full test coverage
- [ ] Week 5: Documentation + code review

**Target completion:** March 28, 2026

---

**Last updated:** 2026-02-26  
**Phase:** Phase 2 Backend (Starting March 1)  
**Estimated effort:** 20-30 hours
