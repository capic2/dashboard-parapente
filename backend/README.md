# Backend - Dashboard Parapente

[![Backend Tests](https://github.com/capic2/dashboard-parapente/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/capic2/dashboard-parapente/actions/workflows/backend-tests.yml)
[![codecov](https://codecov.io/gh/capic2/dashboard-parapente/branch/main/graph/badge.svg)](https://codecov.io/gh/capic2/dashboard-parapente)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)

**Python FastAPI backend with weather aggregation, caching, and scheduling.**

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                  FastAPI Backend                     │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Routes     │  │   Weather    │  │ Scheduler │ │
│  │  (REST API)  │──┤   Pipeline   │──┤ (APSched) │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                  │                 │       │
│         │        ┌─────────▼────────┐       │       │
│         │        │    Scrapers      │       │       │
│         │        │  (5+ sources)    │       │       │
│         │        └──────────────────┘       │       │
│         │                                    │       │
│    ┌────▼──────────────────────────────────▼────┐  │
│    │          Cache Layer (Redis)              │  │
│    │  Development: FakeRedis (in-memory)       │  │
│    │  Production: Redis (persistent)           │  │
│    └───────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
    ┌────▼────┐                 ┌─────▼─────┐
    │ SQLite  │                 │ External  │
    │Database │                 │Weather APIs│
    └─────────┘                 └───────────┘
```

---

## 🚀 Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies (includes fakeredis)
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Initialize database
python -c "from database import Base, engine; import models; Base.metadata.create_all(bind=engine)"
python seed_sites.py

# Start server
python -m uvicorn main:app --reload
```

**Server runs on:** http://localhost:8000  
**No Redis server needed!** FakeRedis runs automatically in dev mode.

📚 **Full guide:** [DEVELOPMENT.md](../DEVELOPMENT.md)

---

## Key Components

### Cache Layer (`cache.py`)

**Development:** FakeRedis (in-memory, automatic)  
**Production:** Redis (persistent, shared)

```python
# Automatically selects based on ENVIRONMENT
ENVIRONMENT=development  → FakeRedis
ENVIRONMENT=production   → Real Redis
```

### Weather Pipeline (`weather_pipeline.py`)

Multi-source data aggregation with consensus algorithm.

### Scheduler (`scheduler.py`)

Background polling every 30 minutes to keep cache warm.

### API Routes (`routes.py`)

REST endpoints for weather, sites, flights, and statistics.

---

## API Documentation

**Interactive Swagger UI:** http://localhost:8000/docs  
**ReDoc:** http://localhost:8000/redoc

📚 **Full API reference:** [docs/API.md](../docs/API.md)

---

## Configuration

See `.env.example` for all available options.

**Key variables:**
- `ENVIRONMENT` - development | production
- `USE_FAKE_REDIS` - true (dev) | false (prod)
- `REDIS_HOST` - Redis server host (production only)
- `SCHEDULER_ENABLED` - Enable background polling

---

## Testing

```bash
# Run all tests
pytest

# With coverage
pytest --cov

# Specific file
pytest tests/test_cache.py
```

---

## More Documentation

- [Main README](../README.md) - Project overview
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Setup guide
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Production deployment
- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - Technical details
- [API.md](../docs/API.md) - API reference

---

**Questions?** Check the documentation above or open an issue.
