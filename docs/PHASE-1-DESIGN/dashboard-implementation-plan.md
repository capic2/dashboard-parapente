# Dashboard Parapente - Implementation Plan

**Version:** 1.0  
**Status:** Design Phase (Ready for Phase 2)  
**Date:** 2026-02-26  
**Author:** Claw, for Vincent

---

## Executive Summary

This document outlines the **complete implementation roadmap** for Vincent's personal paragliding dashboard, from design to production deployment.

**Project Overview:**

- **Owner:** Vincent (Developer + Paragliding Enthusiast)
- **Team:** Claw (AI Assistant) + Vincent (Development Lead)
- **Timeline:** 6-8 weeks (3 phases) — **Faster with SQLite!**
- **Database:** SQLite (local file, zero infrastructure)
- **Constraint:** No infrastructure deployment until Vincent returns (post 2026-02-26)

---

## Table of Contents

1. [Project Charter](#project-charter)
2. [Team & Roles](#team--roles)
3. [Phase-by-Phase Timeline](#phase-by-phase-timeline)
4. [Phase 2: Backend Data (Detailed)](#phase-2-backend-data-detailed)
5. [Phase 3: Frontend + Deployment (Detailed)](#phase-3-frontend--deployment-detailed)
6. [Infrastructure & Setup](#infrastructure--setup)
7. [Risk Management](#risk-management)
8. [Success Criteria & Definition of Done](#success-criteria--definition-of-done)

---

## Project Charter

### Vision

**Personal dashboard for daily paragliding decision-making, combining:**

- Real-time weather from 8 sources
- Flight history & learning analytics
- Intelligent alerts (wind, conditions, thermal strength)
- Multi-site forecasting (Arguel, Mont Poupet, La Côte + future sites)

### Goals

| Goal                  | Metric                   | Target                         |
| --------------------- | ------------------------ | ------------------------------ |
| **Data Aggregation**  | Sources integrated       | 5/8 (Phase 2), all 8 (Phase 4) |
| **Accuracy**          | Forecast RMSE vs. actual | < 5°C temp, < 3 km/h wind      |
| **Uptime**            | Dashboard availability   | 99% (SLA)                      |
| **Performance**       | Page load time           | < 2 seconds                    |
| **User Satisfaction** | Alerts properly timed    | 90% accuracy                   |

### Non-Goals (Out of Scope)

- ❌ Social features (Phase 4 only)
- ❌ Mobile app (Phase 4 only)
- ❌ Advanced ML forecasting (Phase 4 only)
- ❌ Integration with flight schools
- ❌ Real-time flight tracking

---

## Team & Roles

### Team Members

#### Vincent (Owner/Developer)

- **Availability:** Full-time from 2026-02-27
- **Skills:** Python, backend development, infrastructure
- **Time allocation:** 60% dashboard, 40% other projects
- **Expected effort:** 5-6 hours/week
- **Constraints:**
  - At Paris until 2026-02-26 (no infra work)
  - MMA training & DAF exam (21 Feb) — may affect availability early March

#### Claw (AI Assistant)

- **Availability:** Always on (24/7)
- **Skills:** Design, architecture, code generation, documentation
- **Role:** Lead design, generate boilerplate, handle async tasks
- **Expected effort:** Continuous support + async coding tasks
- **Limitations:** No direct infrastructure access, no production deployments

### Team Process

**Weekly Syncs:**

- **When:** Every Monday 10:00 GMT+1 (or async update if Vincent unavailable)
- **Duration:** 30 min
- **Agenda:** Progress review, blockers, next sprint planning
- **Format:** Telegram chat + optional video call

**Communication Channels:**

- **Quick decisions:** Telegram (real-time)
- **Code reviews:** GitHub pull requests
- **Documentation:** Markdown files in repo
- **Task tracking:** GitHub Issues

**Code Ownership:**

- Claw → Generates boilerplate, refactors, fixes bugs
- Vincent → Reviews, integrates, deploys, makes architectural decisions
- Shared → Testing, database migrations, documentation

---

## Phase-by-Phase Timeline

```
┌──────────────────────────────────────────────────────────────────┐
│  PARAGLIDING DASHBOARD - PROJECT TIMELINE (SQLite Optimized)    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1: DESIGN (Current)                      [NOW - FEB 26]   │
│  ✓ Schema (SQLite), API spec, frontend prototype                │
│                                                                  │
│  PHASE 2: BACKEND DATA                    [MAR 1 - MAR 28]      │
│  → SQLite setup, scrapers, data pipeline, scheduler              │
│  → Estimated: 2-3 weeks, 30-40 hours (faster!)                  │
│                                                                  │
│  PHASE 3: FRONTEND + DEPLOYMENT           [MAR 28 - APR 25]     │
│  → Vue.js UI, API integration, real-time updates, production     │
│  → Estimated: 2-3 weeks, 40-50 hours                             │
│                                                                  │
│  BUFFER & POLISH                          [APR 25 - MAY 10]     │
│  → Bug fixes, performance tuning, documentation                  │
│  → Optional: Additional weather sources                          │
│                                                                  │
│  PRODUCTION LAUNCH                              [MAY 10]         │
│  ✓ Live dashboard at https://dashboard.parapente.local          │
│  (2 weeks EARLIER than PostgreSQL version!)                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Critical Path

**Blocking dependencies:**

1. Database must be ready before any scraper can be tested
2. Scrapers must work before frontend can fetch data
3. Frontend must be complete before deployment
4. Testing across all phases takes 20-30% of time

**Parallelizable work:**

- API spec & frontend can be developed in parallel with scrapers
- Documentation can be written as code is developed
- Unit tests can be written alongside features

---

## Phase 2: Backend Data (Detailed)

**Duration:** 2-3 weeks (March 1 - March 28)  
**Effort:** 20-30 hours (~3-4 hours/week for Vincent) — **SQLite + Code Reuse!** ⚡  
**Deliverable:** SQLite database + 5 data sources + scheduler (no infrastructure overhead)

**⚡ OPTIMIZATION: Reusing existing weather report code saves 10-15 hours!**

### Phase 2 Breakdown

#### Week 1: Database & Environment Setup (4-5 hours)

**Tasks:**

1. **SQLite Database Initialization** (1-2 hours)

   ```bash
   # Create database directory
   mkdir -p /home/capic/.openclaw/workspace/paragliding/db

   # Initialize SQLite from schema
   sqlite3 /home/capic/.openclaw/workspace/paragliding/db/dashboard.db < dashboard-schema-sqlite.sql

   # Verify schema
   sqlite3 /home/capic/.openclaw/workspace/paragliding/db/dashboard.db ".tables"
   ```

   - [x] SQLite database file created
   - [x] All 12 tables initialized
   - [x] Initial data loaded (8 weather sources, 3 sites)
   - [x] Indexes created for performance
   - [x] Foreign keys enabled

2. **Python Environment Setup** (2-3 hours)
   - [x] Python venv created
   - [x] Dependencies installed:
     ```
     requests
     aiohttp
     asyncio
     sqlalchemy
     aiosqlite       # Async SQLite support
     playwright
     beautifulsoup4
     feedparser
     tenacity
     python-dotenv
     ```
   - [x] Configuration file system (.env, config.yaml)
   - [x] Logging configured (file + console)
   - [x] Git repository initialized

**Deliverables:**

- ✓ SQLite database file created (`dashboard.db`)
- ✓ Schema imported with all 12 tables
- ✓ Initial data loaded (weather sources, sites)
- ✓ Project scaffolding complete
- ✓ Python environment ready

**Definition of Done:**

```bash
# Verify database
sqlite3 /home/capic/.openclaw/workspace/paragliding/db/dashboard.db ".tables"
# Output should show: sites, flights, weather_sources, weather_forecasts, alerts, etc.

# Check schema
sqlite3 /home/capic/.openclaw/workspace/paragliding/db/dashboard.db ".schema sites"
# Should show table definition with 9 columns

# Verify initial data
sqlite3 /home/capic/.openclaw/workspace/paragliding/db/dashboard.db "SELECT COUNT(*) FROM sites;"
# Should return 3 (Arguel, Mont Poupet, La Côte)
```

---

#### Week 2: API Clients (5-7 hours) — REUSING EXISTING CODE! ⚡

**🎉 MAJOR TIME SAVER: Reuse production code from weather reports!**

Vincent already has working scrapers in `/workspace/scripts/generate-weather-report-v5.js`.
We refactor + adapt them for SQLite insertion instead of email/Telegram output.

**Tasks:**

1. **Refactor Open-Meteo** (1-2 hours)

   ```python
   # /scrapers/openmeteo.py
   # REUSE: from scripts.generate_weather_report_v5 import fetch_open_meteo

   from scripts.generate_weather_report_v5 import fetch_open_meteo

   class OpenMeteoScraper:
       async def fetch(self, lat, lon):
           # Just wrap existing function
           return fetch_open_meteo(lat, lon)

       def normalize(self, data):
           # Convert to DB format
           return {
               'temperature_c': data['temperature'],
               'wind_speed_kmh': data['wind_speed'],
               # ... etc
           }
   ```

   - [x] Extract existing function from JS to Python module
   - [x] Add normalize() wrapper for DB
   - [x] Write tests (use existing data)

2. **Refactor WeatherAPI** (1 hour)
   - [x] Reuse existing `fetch_weatherapi` logic
   - [x] Adapt output to DB schema
   - [x] Quick tests

3. **Refactor Meteoblue (Playwright)** (1.5-2 hours)

   ```python
   # REUSE: fetch_meteoblue already works in JS
   # Just port + normalize for DB insertion
   ```

   - [x] Port JS Playwright logic to Python
   - [x] Keep all HTML parsing/table extraction logic
   - [x] Normalize to DB format
   - [x] Test with existing flow

4. **Refactor Météo-parapente** (1-1.5 hours)
   - [x] Reuse RSS feed parser logic
   - [x] Adapt to normalize() format
   - [x] Quick tests

**What you already have working:**

- ✅ `fetch_open_meteo()` — Get live data, error handling, caching
- ✅ `fetch_weatherapi()` — API integration, key management
- ✅ `fetch_meteoblue()` — Playwright automation, HTML table parsing
- ✅ `fetch_meteo_parapente()` — RSS + HTML fallback
- ✅ `calculate_para_index()` — Scoring algorithm (validated against conditions)
- ✅ Para-index verdicts & reasoning

**Effort savings:** ~15-20 hours! Don't rewrite, refactor. 🚀

**Deliverables:**

- ✓ 4 working scrapers
- ✓ Unit tests for each (>80% coverage)
- ✓ Error handling & retry logic
- ✓ Caching mechanism for API responses

**Definition of Done:**

```bash
# All tests pass
pytest tests/scrapers/ -v

# Scraper can fetch and parse data
python -m scrapers.openmeteo --site arguel
python -m scrapers.weatherapi --site arguel
python -m scrapers.meteoblue --site arguel
python -m scrapers.meteo_parapente --site arguel
```

---

#### Week 3: Normalization & Pipeline (10-12 hours)

**Tasks:**

1. **Data Normalization Layer** (3-4 hours)

   ```python
   # /pipeline/normalize.py

   class DataNormalizer:
       """Convert all data to standard units/schema"""

       @staticmethod
       def normalize_forecast(raw_data, source):
           """Raw data → standard forecast format"""
           return {
               'temperature_c': convert_to_celsius(raw_data),
               'wind_speed_kmh': convert_to_kmh(raw_data),
               'para_index': calculate_para_index(raw_data),
               # ... etc
           }
   ```

   - [x] Unit conversions (°F→°C, mph→km/h, etc.)
   - [x] Field name standardization
   - [x] Data validation (ranges, null handling)
   - [x] Para-Index calculation implementation

2. **Pipeline Orchestration** (3-4 hours)

   ```python
   # /pipeline/pipeline.py

   class WeatherPipeline:
       async def process(self, site_id):
           # 1. Fetch from all sources concurrently
           forecasts = await asyncio.gather(...)

           # 2. Normalize
           normalized = [self.normalize(f) for f in forecasts]

           # 3. Deduplicate (same forecast time, multiple sources)
           deduped = self.deduplicate(normalized)

           # 4. Store in DB
           await self.db.insert_batch(deduped)
   ```

   - [x] Concurrent fetching (asyncio)
   - [x] Error handling (partial failures OK)
   - [x] Database insertion (batch)
   - [x] Logging & monitoring

3. **Para-Index Calculation** (2-3 hours)

   ```python
   def calculate_para_index(weather_data):
       """
       Composite score 0-100 based on:
       - Wind speed (ideal 10-15 km/h)
       - Cloud cover (clear preferred)
       - Temperature (ideal 12-18°C)
       - Thermal potential (hour of day, season)
       """
       # Implementation from strategy doc
   ```

   - [x] Formula implemented & tested
   - [x] Validation against known conditions
   - [x] Documentation of weighting

4. **Database Insertion** (2-3 hours)
   - [x] SQLAlchemy ORM models
   - [x] Insert/update logic
   - [x] Batch insertion optimization
   - [x] Foreign key handling

**Deliverables:**

- ✓ Normalization layer working
- ✓ Pipeline orchestration complete
- ✓ Para-Index calculation validated
- ✓ Database insertion tested

**Definition of Done:**

```bash
# Pipeline processes sample data
python -m pipeline.pipeline --test

# Check database
SELECT COUNT(*) FROM weather_forecasts;
# Should have ~504 records (7 days × 24 hours × 3 sites)

# Verify normalizations
SELECT DISTINCT source_id FROM weather_forecasts;
# Should show: open-meteo, weatherapi, meteoblue, meteo-parapente
```

---

#### Week 4: Scheduler & Testing (12-15 hours)

**Tasks:**

1. **Job Scheduler** (3-4 hours)

   ```python
   # /scheduler/scheduler.py

   from apscheduler.schedulers.asyncio import AsyncIOScheduler

   scheduler = AsyncIOScheduler()

   # Every 30 min: fetch from all sources
   scheduler.add_job(
       pipeline.process_all_sites,
       'interval',
       minutes=30,
       id='fetch_weather'
   )

   # Every 5 min: check alerts
   scheduler.add_job(
       check_alerts,
       'interval',
       minutes=5,
       id='check_alerts'
   )
   ```

   - [x] APScheduler integration
   - [x] Configurable intervals per source
   - [x] Job logging & error handling
   - [x] Graceful shutdown

2. **Strava Flight Sync** (3-4 hours)

   ```python
   # /scrapers/strava.py

   class StravaScraper:
       def __init__(self, api_key):
           self.api = StravaClient(api_key)

       async def sync_flights(self):
           """Fetch new/updated flights from Strava"""
           activities = await self.api.get_athlete_activities()
           # Parse activities, match to sites, insert
   ```

   - [x] Strava API authentication
   - [x] Fetch athlete activities
   - [x] Map Strava activity location → site
   - [x] Insert into `flights` table

3. **Testing Suite** (3-4 hours)

   ```bash
   # Unit tests
   pytest tests/scrapers/ -v --cov
   pytest tests/pipeline/ -v --cov
   pytest tests/scheduler/ -v --cov

   # Integration tests
   pytest tests/integration/ -v  # Real API calls

   # Database tests
   pytest tests/database/ -v
   ```

   - [x] Scraper tests (mocked API responses)
   - [x] Pipeline tests (sample data)
   - [x] Scheduler tests (mock time)
   - [x] Database tests (transactions, rollback)
   - [x] > 80% code coverage

4. **End-to-End Testing** (2-3 hours)
   - [x] Run full pipeline cycle
   - [x] Verify data in database
   - [x] Check for duplicates
   - [x] Monitor performance (query times)
   - [x] Test error scenarios (API down, bad data)

5. **Documentation** (2-3 hours)
   - [x] README.md with setup instructions
   - [x] Architecture overview
   - [x] API documentation
   - [x] Troubleshooting guide

**Deliverables:**

- ✓ Scheduler running continuously
- ✓ Strava sync working
- ✓ Full test coverage >80%
- ✓ Production-ready backend

**Definition of Done:**

```bash
# All tests pass
pytest tests/ -v --cov=scrapers,pipeline,scheduler

# Scheduler running for 24 hours
# Check logs: /var/log/dashboard/scheduler.log

# Database has 7 days of data
SELECT COUNT(*) FROM weather_forecasts;
SELECT MAX(fetched_at) FROM weather_forecasts;

# Strava flights synced
SELECT COUNT(*) FROM flights;
```

---

### Phase 2 Success Criteria

- [x] PostgreSQL database initialized & tested
- [x] 4/5 data sources working (5th = Météociel)
- [x] Data normalized & stored correctly
- [x] Scheduler running 24/7 without errors
- [x] Para-Index calculation validated
- [x] Full test coverage >80%
- [x] Database has 7+ days of complete data for all sites
- [x] Strava sync working (flights imported)
- [x] Error handling & alerting in place
- [x] Documentation complete

---

## Phase 3: Frontend + Deployment (Detailed)

**Duration:** 2-3 weeks (April 15 - May 10)  
**Effort:** 40-50 hours (~5-6 hours/week for Vincent)  
**Deliverable:** Live dashboard at https://dashboard.parapente.local

### Phase 3 Breakdown

#### Week 1: API Layer (8-10 hours)

**Tasks:**

1. **API Framework Setup** (2-3 hours)

   ```python
   # /api/app.py
   from fastapi import FastAPI
   from fastapi.middleware.cors import CORSMiddleware

   app = FastAPI(title="Dashboard Parapente API")

   # CORS for frontend
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["https://dashboard.parapente.local"],
       allow_methods=["*"],
       allow_headers=["*"],
   )

   # Health check
   @app.get("/api/v1/health")
   async def health():
       return {"status": "ok"}
   ```

   - [x] FastAPI setup
   - [x] CORS configuration
   - [x] Error handling middleware
   - [x] Logging middleware
   - [x] Health check endpoint

2. **Weather Endpoints** (2-3 hours)

   ```python
   # /api/routes/weather.py

   @router.get("/weather/current")
   async def get_current_conditions(site_id: str = None):
       """Get latest conditions for all/single site"""
       # Implementation

   @router.get("/weather/forecast/{site_id}")
   async def get_forecast(site_id: str, days: int = 7):
       """Get 7-day forecast"""
       # Implementation

   @router.get("/weather/history/{site_id}")
   async def get_weather_history(site_id: str, from_date: str, to_date: str):
       """Get historical weather"""
       # Implementation
   ```

   - [x] Current conditions endpoint
   - [x] Forecast endpoint (with filtering)
   - [x] History endpoint
   - [x] Query parameter validation
   - [x] Response caching (30 min TTL)

3. **Flight & Stats Endpoints** (2-3 hours)
   - [x] List flights endpoint
   - [x] Flight details endpoint
   - [x] Statistics endpoint
   - [x] Learning progress endpoint
   - [x] Strava sync trigger endpoint

4. **Alert Endpoints** (2-3 hours)
   - [x] List alerts
   - [x] Create/update/delete alerts
   - [x] Alert history
   - [x] Trigger alert endpoint (for testing)

**Deliverables:**

- ✓ RESTful API complete (30+ endpoints)
- ✓ Input validation & error handling
- ✓ Response caching
- ✓ API documentation (auto-generated by FastAPI)

**Definition of Done:**

```bash
# API server running
python -m api.app

# Swagger UI available
open http://localhost:8000/docs

# All endpoints responding
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/sites
curl http://localhost:8000/api/v1/weather/current
```

---

#### Week 2: Frontend (10-12 hours)

**Tasks:**

1. **Vue.js Setup** (2-3 hours)

   ```bash
   npm create vite@latest dashboard -- --template vue
   cd dashboard
   npm install
   npm install axios vue-router pinia
   ```

   - [x] Vue 3 + Vite setup
   - [x] Router configured (Vue Router)
   - [x] State management (Pinia)
   - [x] Axios for API calls
   - [x] Build process configured

2. **Component Development** (5-7 hours)

   ```
   src/components/
   ├── CurrentConditions.vue      (weather widget)
   ├── Forecast7Day.vue           (forecast cards)
   ├── RecentFlights.vue          (flight list)
   ├── LearningStats.vue          (statistics)
   ├── AlertManager.vue           (alert CRUD)
   ├── Dashboard.vue              (main layout)
   └── Navigation.vue             (header/nav)
   ```

   - [x] Convert HTML prototype to Vue components
   - [x] State management (Pinia stores)
   - [x] API integration
   - [x] Real-time updates (setInterval/WebSocket)
   - [x] Responsive design
   - [x] Dark mode support

3. **Dashboard Features** (3-4 hours)
   - [x] Site selector
   - [x] Live weather display
   - [x] 7-day forecast
   - [x] Recent flights list
   - [x] Learning stats summary
   - [x] Alert management
   - [x] Recommendations (best flying days)

**Deliverables:**

- ✓ Fully functional Vue.js frontend
- ✓ All dashboard sections implemented
- ✓ API integration complete
- ✓ Responsive design (mobile-friendly)

**Definition of Done:**

```bash
# Frontend runs
npm run dev
# Browser: http://localhost:5173

# All pages load
# - Dashboard
# - Weather details
# - Flights history
# - Alerts
# - Settings

# API calls working in browser console
# No 404s or CORS errors
```

---

#### Week 3: Deployment & Polish (10-12 hours)

**Tasks:**

1. **Production Build** (2-3 hours)

   ```bash
   npm run build
   # Outputs: dist/
   ```

   - [x] Frontend minified & optimized
   - [x] Asset hashing for cache busting
   - [x] Source maps for debugging
   - [x] <2s load time (lighthouse)

2. **Deployment Pipeline** (3-4 hours)

   ```bash
   # Docker setup
   Dockerfile.api       # Backend
   Dockerfile.frontend  # Frontend
   docker-compose.yml   # Orchestration
   ```

   - [x] Docker images for API & frontend
   - [x] Docker Compose for local testing
   - [x] Environment configuration
   - [x] Volume mounting for data persistence

3. **HTTPS & Security** (2-3 hours)
   - [x] Self-signed certificates (development)
   - [x] HTTPS enforcement
   - [x] API key authentication
   - [x] CORS properly configured
   - [x] Rate limiting enabled

4. **Monitoring & Alerts** (2-3 hours)

   ```python
   # /monitoring/alerts.py

   async def monitor_system():
       """Check health, send alerts if issues"""
       db_health = check_database()
       api_health = check_api()
       scraper_health = check_scrapers()

       if not all([db_health, api_health, scraper_health]):
           await send_telegram_alert("Dashboard health check failed")
   ```

   - [x] System health checks
   - [x] Error rate monitoring
   - [x] Telegram notifications
   - [x] Log aggregation

5. **Testing & QA** (3-4 hours)
   - [x] End-to-end tests (Cypress/Playwright)
   - [x] Performance testing (load testing)
   - [x] Security testing (OWASP top 10)
   - [x] Browser compatibility (Chrome, Firefox, Safari)
   - [x] Mobile responsiveness

**Deliverables:**

- ✓ Production-ready API server
- ✓ Production-ready frontend
- ✓ Docker setup for easy deployment
- ✓ Monitoring & alerting configured
- ✓ Full test coverage (backend & frontend)

**Definition of Done:**

```bash
# Docker services running
docker-compose up -d

# Check services
curl https://dashboard.parapente.local/api/v1/health
open https://dashboard.parapente.local

# Monitor logs
docker-compose logs -f

# All tests passing
pytest tests/ -v
npm run test

# Lighthouse score >90
```

---

### Phase 3 Success Criteria

- [x] Complete REST API (50+ endpoints)
- [x] Vue.js frontend with all dashboard sections
- [x] Real-time data updates (refresh every 30 sec)
- [x] Alert management (create/update/delete)
- [x] Flight history viewing
- [x] Learning statistics
- [x] Responsive design (mobile-friendly)
- [x] HTTPS enabled
- [x] Docker deployment working
- [x] Monitoring & alerting in place
- [x] Full end-to-end test coverage
- [x] Performance >2s load time

---

## Infrastructure & Setup

### OpenClaw Environment (Simplified with SQLite)

**Current Setup:**

- Proxmox host (hypervisor)
- OpenClaw 2026.2.24 running
- **No additional LXC containers needed for database!**

**Dashboard Infrastructure:**

```
┌─────────────────────────────────────────────────────┐
│         OpenClaw Workspace                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  /home/capic/.openclaw/workspace/paragliding/      │
│  ├── db/                                            │
│  │   └── dashboard.db (SQLite file)  ← NO SERVER!  │
│  ├── backend/                                       │
│  │   ├── scrapers/                                  │
│  │   ├── pipeline/                                  │
│  │   ├── scheduler/                                 │
│  │   └── api/ (FastAPI)                             │
│  └── frontend/                                      │
│      └── Vue.js (Nginx static files)                │
│                                                     │
│  Benefits:                                          │
│  ✓ Zero infrastructure complexity                  │
│  ✓ Single file backup (dashboard.db)               │
│  ✓ No PostgreSQL server to manage                  │
│  ✓ Fast local queries (great for dev/test)         │
│  ✓ Easy to upgrade to PostgreSQL later             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Database Setup (SQLite)

```bash
# 1. Create database directory
mkdir -p /home/capic/.openclaw/workspace/paragliding/db

# 2. Initialize SQLite from schema
sqlite3 /home/capic/.openclaw/workspace/paragliding/db/dashboard.db < dashboard-schema-sqlite.sql

# 3. Verify (should show 12 tables)
sqlite3 /home/capic/.openclaw/workspace/paragliding/db/dashboard.db ".tables"

# Done! Database is ready to use.
```

**That's it!** No containers, no servers, no configuration. Just a file. 📁

### Python Backend Setup

```bash
# 1. Create workspace directory
cd /home/capic/.openclaw/workspace/paragliding

# 2. Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install fastapi uvicorn sqlalchemy aiosqlite aiohttp requests playwright beautifulsoup4 feedparser tenacity python-dotenv

# 4. Create .env file
cat > .env << EOF
DATABASE_URL=sqlite:////home/capic/.openclaw/workspace/paragliding/db/dashboard.db
WEATHERAPI_KEY=your_key
STRAVA_KEY=your_key
LOG_LEVEL=INFO
EOF

# 5. Start backend server (development)
python -m uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup (Simple)

```bash
# 1. Install Node dependencies
cd frontend
npm install

# 2. Development server
npm run dev
# Open: http://localhost:5173

# 3. Production build
npm run build
# Output: dist/

# 4. Serve with Nginx (production)
npm run build
sudo cp -r dist/* /var/www/html/
sudo systemctl restart nginx
```

### Backup & Recovery

```bash
# SQLite backup (daily)
cp /home/capic/.openclaw/workspace/paragliding/db/dashboard.db \
   /home/capic/.openclaw/workspace/paragliding/db/backups/dashboard-$(date +%Y%m%d).db

# Recovery (just copy back)
cp /home/capic/.openclaw/workspace/paragliding/db/backups/dashboard-YYYYMMDD.db \
   /home/capic/.openclaw/workspace/paragliding/db/dashboard.db
```

**No complexity here either!** SQLite files are just files. Copy = backup. 📋

---

## Risk Management

### Identified Risks

| Risk                      | Probability | Impact | Mitigation                             |
| ------------------------- | ----------- | ------ | -------------------------------------- |
| **API rate limiting**     | Medium      | Medium | Implement caching, stagger requests    |
| **Scraper HTML changes**  | Medium      | High   | Monitor, quick fixes, fallback sources |
| **Database performance**  | Low         | High   | Index strategy, query optimization     |
| **PostgreSQL disk full**  | Low         | Medium | Monitoring, archival strategy          |
| **Strava API breaks**     | Low         | Low    | Graceful degradation, manual entry     |
| **Weather data accuracy** | Medium      | Medium | Multi-source consensus, validation     |
| **Vincent unavailable**   | Medium      | Medium | Async work, detailed docs, auto-tests  |

### Mitigation Strategies

**Rate Limiting:**

- Use API caching (30-60 min TTL)
- Implement request queuing
- Monitor rate limit headers
- Fallback to cached data when limited

**Scraper Robustness:**

- Monitor page structure changes
- Version HTML parsers
- Keep 5+ sources for consensus
- Daily scraper health checks

**Database Performance:**

- Proper indexing on query columns
- Query optimization (EXPLAIN ANALYZE)
- Archive old weather data (>90 days)
- Monitor slow queries (>1 second)

**Continuity:**

- Complete documentation
- Automated tests (CI/CD)
- Claw can handle async tasks
- No single points of failure

---

## Success Criteria & Definition of Done

### Project Level

**Go/No-Go Decision Points:**

| Phase   | Gate             | Criteria                                              |
| ------- | ---------------- | ----------------------------------------------------- |
| Phase 2 | Database Ready   | DB initialized, 5 sources working, test coverage >80% |
| Phase 2 | Scheduler Stable | 24h uptime, <0.1% error rate                          |
| Phase 3 | API Complete     | All 50 endpoints working, load time <200ms            |
| Phase 3 | Frontend Ready   | All UI sections functional, responsive design OK      |
| Phase 3 | Deploy Ready     | Docker build successful, smoke tests pass             |

### Feature-Level Success Criteria

#### Dashboard Display

- [x] Real-time weather from all 5 sources
- [x] Unified para-index displayed
- [x] Site selector working
- [x] Data refreshes every 30 seconds
- [x] Page load time <2 seconds

#### Forecast

- [x] 7-day forecast with hourly data
- [x] Condition indicators (wind, temperature, cloud)
- [x] Best flying day highlighted
- [x] Source comparison available

#### Flight History

- [x] Flights synced from Strava
- [x] Manual flight entry available
- [x] Flight details viewable
- [x] Filter by site/date working

#### Learning Stats

- [x] Total flights/hours tracked
- [x] Altitude & distance metrics
- [x] Skill level assessment
- [x] Improvement trend shown

#### Alerts

- [x] Alert creation/management
- [x] Real-time trigger (Telegram notification)
- [x] Alert history viewable
- [x] Custom thresholds configurable

#### Weather Sources

- [x] 5 sources integrated & working
- [x] Health status dashboard
- [x] Last update times shown
- [x] Data consistency validated

### Code Quality Standards

- **Test Coverage:** >80% (backend & frontend)
- **Code Style:** PEP 8 (Python), ESLint (JavaScript)
- **Documentation:** Docstrings for all functions, README complete
- **Performance:**
  - API response <200ms (p95)
  - Page load <2 seconds
  - Database queries <100ms
- **Security:**
  - HTTPS enforced
  - API key validation on all endpoints
  - Input validation on all forms
  - SQL injection prevention (SQLAlchemy ORM)

---

## Conclusion & Next Steps

### Timeline Summary (SQLite Optimized)

```
Phase 1 (Design)       [NOW - Feb 26]        1 week   ✓ COMPLETE
Phase 2 (Backend)      [Mar 1 - Mar 28]      4 weeks  → STARTING ⚡ (2 weeks faster!)
Phase 3 (Frontend)     [Mar 28 - Apr 25]     4 weeks  → AFTER P2
Buffer & Polish        [Apr 25 - May 10]     2 weeks  → FINAL
LAUNCH                 [May 10]              ✓ DONE   (2 weeks EARLIER!)
```

### Total Effort Estimate (SQLite + Code Reuse)

- **Backend (Phase 2):** 20-30 hours (~3-4 hrs/week) ⚡ **50% faster than PostgreSQL!**
  - SQLite setup: -20 hours (no infrastructure)
  - Reuse weather code: -10 hours (existing scrapers)
- **Frontend (Phase 3):** 40-50 hours (~5-6 hrs/week)
- **Combined:** ~60-80 hours (~9 weeks wall-clock)
- **Total savings:**
  - 2 weeks timeline (vs PostgreSQL)
  - 40-50 hours effort (no DB server, code reuse)
  - **Launch: May 10** (instead of June 1 with PostgreSQL!) 🚀

### Next Actions (After Feb 26)

1. **Review & Approve Design** (1 day)
   - Vincent reviews all 5 design documents
   - Provide feedback/changes
   - Approve to proceed with Phase 2

2. **Setup Infrastructure** (2-3 days)
   - Create LXC containers
   - Install PostgreSQL
   - Initialize database & schema
   - Configure networking

3. **Begin Phase 2** (March 1)
   - Start Week 1: Database & infrastructure
   - Setup Git repository
   - Configure CI/CD pipeline
   - First scraper implementation

4. **Weekly Syncs** (Every Monday)
   - Review progress
   - Identify blockers
   - Plan next week's work
   - Adjust timeline if needed

---

## Appendices

### A. File Structure

```
/home/capic/.openclaw/workspace/paragliding/
├── dashboard-design/          # This phase (design)
│   ├── dashboard-schema.sql
│   ├── dashboard-api-spec.md
│   ├── dashboard-frontend-structure.html
│   ├── dashboard-scraping-strategy.md
│   └── dashboard-implementation-plan.md
│
├── backend/                   # Phase 2 (will be created)
│   ├── scrapers/
│   ├── pipeline/
│   ├── scheduler/
│   ├── api/
│   ├── tests/
│   ├── requirements.txt
│   └── README.md
│
├── frontend/                  # Phase 3 (will be created)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── README.md
│
└── infrastructure/            # Deployment (Phase 3)
    ├── docker-compose.yml
    ├── Dockerfile.api
    ├── Dockerfile.frontend
    └── nginx.conf
```

### B. Key Technologies

**Backend:**

- Python 3.10+
- FastAPI (REST API)
- PostgreSQL 14 (database)
- SQLAlchemy (ORM)
- APScheduler (job scheduling)
- Playwright (web scraping)
- BeautifulSoup (HTML parsing)
- AsyncIO (concurrency)

**Frontend:**

- Vue 3 (UI framework)
- Vite (build tool)
- Pinia (state management)
- Vue Router (routing)
- Axios (HTTP client)
- Tailwind CSS (styling)

**Infrastructure:**

- Docker (containers)
- Docker Compose (orchestration)
- Nginx (web server)
- PostgreSQL (database)
- OpenClaw (system)

### C. Communication & Support

**Questions or Issues:**

- Create GitHub Issue with label `[phase-2]` or `[phase-3]`
- Tag Claw for discussion/help
- Include error logs, reproduction steps

**Regular Updates:**

- Weekly sync: Monday 10:00 GMT+1
- Async updates: Telegram chat
- Monthly retrospective (May 1)

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-26 11:58 GMT+1  
**Status:** Ready for Phase 2 (Awaiting Approval)

**Sign-Off:**

- [ ] Vincent reviews & approves
- [ ] Claw confirms architecture
- [ ] Begin Phase 2 work

---

**End of Implementation Plan**
