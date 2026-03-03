# 🏗️ Architecture Overview

> **Technical architecture documentation for Dashboard Parapente**

---

## System Overview

Dashboard Parapente is a full-stack web application that aggregates weather data from multiple sources to provide paragliding pilots with accurate flying condition forecasts.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                        │
│                    (React + TypeScript)                     │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                             │
┌────────────────────────────▼────────────────────────────────┐
│                       FastAPI Backend                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Routes     │  │   Weather    │  │  Scheduler   │     │
│  │  (REST API)  │  │   Pipeline   │  │ (APScheduler)│     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│         ┌──────────────────┴──────────────────┐             │
│         │                                      │             │
│    ┌────▼─────┐                          ┌────▼─────┐       │
│    │  Cache   │                          │ Scrapers │       │
│    │ (Redis)  │                          │ (8 src)  │       │
│    └──────────┘                          └──────────┘       │
└───────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
        ┌─────▼─────┐               ┌──────▼──────┐
        │  SQLite   │               │  External   │
        │  Database │               │  Weather    │
        │  (Local)  │               │  APIs       │
        └───────────┘               └─────────────┘
```

---

## Components

### 1. Frontend (React + TypeScript)

**Tech Stack:**
- React 18 with TypeScript
- TanStack Query (data fetching & caching)
- Tailwind CSS (styling)
- React Router (navigation)
- Recharts (data visualization)
- Vite (build tool)

**Key Features:**
- Component-based architecture
- Type-safe API calls with Zod validation
- Optimistic UI updates
- Prefetching on hover for instant navigation
- Responsive design (mobile-first)

**File Structure:**
```
frontend/src/
├── components/          # Reusable UI components
│   ├── SiteSelector.tsx
│   ├── MultiOrientationSelector.tsx
│   ├── CurrentConditions.tsx
│   ├── HourlyForecast.tsx
│   └── Forecast7Day.tsx
├── pages/               # Page components
│   ├── Dashboard.tsx
│   ├── FlightHistory.tsx
│   └── Settings.tsx
├── hooks/               # Custom React hooks
│   ├── useWeather.ts
│   ├── useSites.ts
│   └── useBestSpot.ts
├── types/               # TypeScript type definitions
├── schemas.ts           # Zod validation schemas
└── api/                 # API client functions
```

---

### 2. Backend (Python FastAPI)

**Tech Stack:**
- FastAPI (REST API framework)
- SQLAlchemy (ORM)
- APScheduler (job scheduling)
- Pydantic (data validation)
- Redis / FakeRedis (caching)
- aiohttp (async HTTP client)

**Key Features:**
- Asynchronous request handling
- Automatic OpenAPI documentation
- Request/response validation with Pydantic
- Background task scheduling
- Multi-source data aggregation

**File Structure:**
```
backend/
├── main.py              # FastAPI app entry point
├── routes.py            # API endpoints
├── models.py            # SQLAlchemy models
├── schemas.py           # Pydantic schemas
├── database.py          # Database connection
├── cache.py             # Redis cache layer
├── scheduler.py         # Weather polling scheduler
├── weather_pipeline.py  # Data aggregation & consensus
└── scrapers/            # Weather source scrapers
    ├── openmeteo.py
    ├── weatherapi.py
    ├── meteoblue.py
    ├── meteo_parapente.py
    └── meteociel.py
```

---

### 3. Caching Layer

**Development: FakeRedis**
- In-memory Python implementation
- No server required
- Perfect for single-process development
- Data cleared on restart

**Production: Redis**
- Persistent key-value store
- Shared cache between processes
- AOF + RDB persistence
- LRU eviction policy

**Cache Strategy:**
- TTL: 30 minutes (weather data)
- Cache warming on startup
- Automatic invalidation
- Keys format: `weather:{prefix}:{hash}`

**Cached Data:**
- Weather forecasts (per site, per day)
- Aggregated consensus data
- Source-specific predictions
- Site information

---

### 4. Data Pipeline

#### Weather Data Flow

```
External APIs
     │
     ├─► Open-Meteo ────────┐
     ├─► WeatherAPI ────────┤
     ├─► Meteoblue ─────────┤
     ├─► Météo-parapente ───┤
     ├─► Météociel ─────────┤
     └─► [Other sources] ───┤
                             │
                    ┌────────▼──────────┐
                    │   Normalization   │
                    │  (weather_pipeline)│
                    └────────┬──────────┘
                             │
                    ┌────────▼──────────┐
                    │  Consensus Engine │
                    │ (median + outliers)│
                    └────────┬──────────┘
                             │
                    ┌────────▼──────────┐
                    │  Para-Index Calc  │
                    │  (scoring algo)   │
                    └────────┬──────────┘
                             │
                    ┌────────▼──────────┐
                    │   Cache (Redis)   │
                    └───────────────────┘
                             │
                    ┌────────▼──────────┐
                    │    API Response   │
                    └───────────────────┘
```

#### Data Normalization

Each scraper outputs standardized format:

```python
{
    "source": "open-meteo",
    "site_id": "site-arguel",
    "timestamp": "2026-03-03T12:00:00Z",
    "temperature": 18.5,       # °C
    "wind_speed": 12.3,        # km/h
    "wind_direction": 225,     # degrees
    "wind_gust": 18.7,         # km/h
    "precipitation": 0.0,      # mm
    "cloud_cover": 45,         # %
    "confidence": 0.85         # 0-1
}
```

#### Consensus Algorithm

```python
def calculate_consensus(sources: List[WeatherData]) -> ConsensusData:
    """
    Calculate consensus from multiple sources.
    
    1. Remove outliers (>2 std dev from median)
    2. Calculate median for each metric
    3. Weight by source confidence
    4. Flag low-confidence predictions
    """
    # Example for temperature
    temps = [s.temperature for s in sources]
    median_temp = statistics.median(temps)
    
    # Remove outliers
    std_dev = statistics.stdev(temps)
    filtered = [t for t in temps if abs(t - median_temp) < 2 * std_dev]
    
    # Weighted average
    weights = [s.confidence for s in sources]
    consensus_temp = weighted_average(filtered, weights)
    
    return consensus_temp
```

---

### 5. Scheduler Architecture

**APScheduler Configuration:**
```python
scheduler = AsyncIOScheduler(
    job_defaults={
        'coalesce': True,          # Combine missed runs
        'max_instances': 1,        # One job at a time
        'misfire_grace_time': 300  # 5 min grace period
    }
)

# Poll weather every 30 minutes
scheduler.add_job(
    poll_all_sites,
    trigger='interval',
    minutes=30,
    id='weather_polling'
)
```

**Job Flow:**
1. Fetch weather for all sites
2. Normalize data
3. Calculate consensus
4. Compute Para-Index
5. Cache results (30min TTL)
6. Log metrics

**Monitoring:**
- Job execution time
- Success/failure rate
- API rate limits
- Cache hit ratio

---

### 6. Database Schema

**SQLite Tables:**

```sql
-- Sites
CREATE TABLE sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation_m INTEGER,
    orientation TEXT,
    rating INTEGER,
    is_active BOOLEAN DEFAULT 1
);

-- Flights
CREATE TABLE flights (
    id TEXT PRIMARY KEY,
    site_id TEXT REFERENCES sites(id),
    flight_date TEXT NOT NULL,
    duration_minutes INTEGER,
    max_altitude_m INTEGER,
    distance_km REAL,
    elevation_gain_m INTEGER,
    notes TEXT,
    gpx_file_path TEXT
);

-- Alerts
CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    site_id TEXT REFERENCES sites(id),
    condition_type TEXT,
    operator TEXT,
    threshold_min REAL,
    threshold_max REAL,
    is_active BOOLEAN DEFAULT 1,
    notify_via TEXT
);
```

**Indexes:**
```sql
CREATE INDEX idx_flights_date ON flights(flight_date DESC);
CREATE INDEX idx_flights_site ON flights(site_id);
CREATE INDEX idx_alerts_active ON alerts(is_active, site_id);
```

---

## Data Flow Examples

### 1. User Requests Weather Forecast

```
User clicks site selector
        │
        ▼
Frontend: useWeather hook
        │
        ▼
TanStack Query checks cache
        │
        ├─► CACHE HIT ──► Return cached data (instant)
        │
        └─► CACHE MISS
                │
                ▼
        API Request: GET /api/weather/combined/{site}/{day}
                │
                ▼
        Backend checks Redis
                │
                ├─► CACHE HIT ──► Return cached data
                │
                └─► CACHE MISS
                        │
                        ▼
                Run weather_pipeline.get_combined_forecast()
                        │
                        ├─► Fetch from all scrapers (parallel)
                        ├─► Normalize data
                        ├─► Calculate consensus
                        ├─► Compute Para-Index
                        ├─► Cache in Redis (30min TTL)
                        └─► Return response
                                │
                                ▼
                        Frontend updates UI
```

### 2. Scheduler Polls Weather Data

```
Every 30 minutes:
        │
        ▼
Scheduler triggers poll_all_sites()
        │
        ▼
For each site:
        │
        ├─► Fetch weather (next 7 days)
        ├─► Normalize & calculate consensus
        ├─► Compute Para-Index
        └─► Cache in Redis
                │
                ▼
        Log metrics & success
                │
                ▼
Next poll in 30 minutes
```

---

## Performance Characteristics

### Latency

| Operation | Development (FakeRedis) | Production (Redis) |
|-----------|------------------------|---------------------|
| **Cache hit** | <1 ms | <5 ms |
| **Cache miss (scrape)** | 2-5 seconds | 2-5 seconds |
| **API request** | 10-50 ms | 20-100 ms |
| **Database query** | <1 ms | <5 ms |

### Throughput

| Component | Requests/sec |
|-----------|--------------|
| **Frontend** | 100+ (static serving) |
| **Backend API** | 50-100 (single instance) |
| **Redis** | 10,000+ (reads) |
| **Scrapers** | Limited by external APIs |

### Scalability

**Horizontal Scaling:**
- Frontend: Infinite (static files)
- Backend: Scale with load balancer (3-10 instances typical)
- Redis: Single instance (can add read replicas)
- Database: SQLite → PostgreSQL for high load

**Vertical Scaling:**
- 2 CPU / 2 GB RAM: 10-50 concurrent users
- 4 CPU / 4 GB RAM: 50-200 concurrent users
- 8 CPU / 8 GB RAM: 200-500 concurrent users

---

## Security Model

### Authentication (Future)

Currently: No authentication (personal dashboard)

**Planned:**
- JWT token-based auth
- OAuth2 (Google, GitHub)
- API key for external access

### Authorization

- Site data: Public read
- Flights: User-specific
- Alerts: User-specific

### Data Protection

- API keys: Environment variables only
- Passwords: Bcrypt hashing (when auth added)
- HTTPS: Required in production
- CORS: Restricted to known domains

---

## Technology Choices

### Why FastAPI?

- ✅ Async support (concurrent scrapers)
- ✅ Automatic OpenAPI docs
- ✅ Fast performance (comparable to Node.js)
- ✅ Type safety with Pydantic
- ✅ Easy to deploy

### Why React + TypeScript?

- ✅ Type safety reduces bugs
- ✅ Excellent tooling (VSCode, ESLint)
- ✅ Large ecosystem
- ✅ React Query simplifies data fetching
- ✅ Tailwind for rapid UI development

### Why Redis?

- ✅ Fast in-memory caching
- ✅ Built-in TTL support
- ✅ Persistence options (AOF, RDB)
- ✅ Pub/sub for real-time updates (future)
- ✅ FakeRedis for dev (no server needed)

### Why SQLite?

- ✅ Zero configuration
- ✅ Single file (easy backups)
- ✅ Fast for read-heavy workloads
- ✅ WAL mode for concurrency
- ✅ Sufficient for <10k flights

**When to migrate to PostgreSQL:**
- >100k flights
- >1000 concurrent users
- Need full-text search
- Geographic queries

---

## Future Enhancements

### Short-term (Next 3 months)

- [ ] Add user authentication
- [ ] Implement alert system (Telegram notifications)
- [ ] Add more weather sources
- [ ] Improve Para-Index algorithm with machine learning

### Medium-term (3-6 months)

- [ ] Mobile app (React Native)
- [ ] Offline mode (PWA)
- [ ] Real-time weather updates (WebSocket)
- [ ] Community features (spot ratings, comments)

### Long-term (6-12 months)

- [ ] Predictive analytics (best days to fly)
- [ ] Flight planning tools
- [ ] Integration with flight instruments
- [ ] Multi-user support (clubs, schools)

---

**Last updated:** 2026-03-03  
**Maintained by:** Dashboard Parapente Team
