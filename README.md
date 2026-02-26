# 🪂 Dashboard Parapente

Personal paragliding weather dashboard combining real-time conditions from 8 sources with flight analytics.

**Status:** Phase 1 Design Complete ✅ → Phase 2 (Backend) Starting March 1, 2026

---

## 📊 Features

- **Real-time weather** from 8 sources (Open-Meteo, WeatherAPI, Meteoblue, Météo-parapente, Météociel, Parapente.net, Windy, Planete-voile)
- **Unified Para-Index** scoring (0-100 composite flying conditions)
- **Flight history** synced from Strava with learning analytics
- **Intelligent alerts** (Telegram notifications)
- **7-day forecast** with hourly granularity
- **Multi-site tracking** (Arguel, Mont Poupet, La Côte + future sites)
- **Source comparison** to identify most accurate provider for your region

---

## 🏗️ Architecture

```
dashboard-repo/
├── docs/                          # Design & specification
│   ├── PHASE-1-DESIGN/
│   │   ├── dashboard-schema-sqlite.sql
│   │   ├── dashboard-api-spec.md
│   │   ├── dashboard-frontend-structure.html
│   │   ├── dashboard-implementation-plan.md
│   │   ├── dashboard-scraping-strategy.md
│   │   ├── CODE-REUSE-PLAN.md
│   │   └── SQLITE-UPGRADE.md
│   └── README.md
│
├── backend/                       # Python backend (Phase 2)
│   ├── scrapers/
│   │   ├── __init__.py
│   │   ├── openmeteo.py          # Open-Meteo API client
│   │   ├── weatherapi.py         # WeatherAPI client
│   │   ├── meteoblue.py          # Meteoblue scraper (Playwright)
│   │   ├── meteo_parapente.py    # Météo-parapente feed
│   │   ├── para_index.py         # Para-Index calculation
│   │   └── base.py               # Base scraper class
│   │
│   ├── pipeline/
│   │   ├── __init__.py
│   │   ├── pipeline.py           # Data orchestration
│   │   └── normalize.py          # Data validation & normalization
│   │
│   ├── scheduler/
│   │   ├── __init__.py
│   │   └── scheduler.py          # APScheduler integration
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── app.py                # FastAPI application
│   │   ├── routes/
│   │   │   ├── weather.py
│   │   │   ├── flights.py
│   │   │   ├── alerts.py
│   │   │   └── stats.py
│   │   └── models.py             # SQLAlchemy ORM models
│   │
│   ├── tests/
│   │   ├── test_scrapers.py
│   │   ├── test_pipeline.py
│   │   ├── test_api.py
│   │   └── fixtures/
│   │       └── (test data)
│   │
│   ├── db/
│   │   ├── dashboard.db          # SQLite database (local)
│   │   ├── backups/              # Daily backups
│   │   └── migrations.py         # Schema versioning
│   │
│   ├── .env.example
│   ├── requirements.txt
│   └── README.md
│
├── frontend/                      # Vue.js frontend (Phase 3)
│   ├── src/
│   │   ├── components/
│   │   ├── views/
│   │   ├── stores/
│   │   ├── App.vue
│   │   └── main.js
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
├── infrastructure/                # Deployment configs
│   ├── docker-compose.yml         # Local dev
│   ├── Dockerfile.api
│   ├── Dockerfile.frontend
│   ├── nginx.conf
│   └── README.md
│
├── .gitignore
├── .github/
│   └── workflows/                 # CI/CD (GitHub Actions)
│       ├── test.yml
│       └── deploy.yml
│
├── CHANGELOG.md                   # Version history
├── LICENSE                        # BSD-3-Clause
└── README.md                      # THIS FILE
```

---

## 🚀 Getting Started

### Phase 1: Design (Complete ✅)
- [x] Database schema (SQLite)
- [x] API specification
- [x] Frontend prototype
- [x] Scraping strategy
- [x] Implementation plan

📍 **Documents:** `docs/PHASE-1-DESIGN/`

### Phase 2: Backend (March 1 - March 28)
- Database setup + schema migration
- Weather data scrapers (reuse existing code)
- Data pipeline & normalization
- Job scheduler
- Testing & documentation

**Effort:** 20-30 hours (~4 hrs/week)

### Phase 3: Frontend (March 28 - April 25)
- REST API development
- Vue.js dashboard UI
- Real-time updates
- Deployment & monitoring

**Effort:** 40-50 hours (~6 hrs/week)

### Launch: May 10, 2026 🎉

---

## 📋 Requirements

### Backend
- Python 3.10+
- SQLite (no server needed!)
- Playwright (for web scraping)

### Frontend
- Node 18+
- Vue 3
- Vite

### Deployment
- Nginx (reverse proxy)
- Docker (optional)

---

## 📚 Documentation

- **[Phase 1 Design](docs/PHASE-1-DESIGN/)** — Complete specifications
- **[Backend README](backend/README.md)** — Setup & development
- **[Frontend README](frontend/README.md)** — UI development
- **[Infrastructure](infrastructure/README.md)** — Deployment guide
- **[API Spec](docs/PHASE-1-DESIGN/dashboard-api-spec.md)** — 50+ endpoints
- **[Implementation Plan](docs/PHASE-1-DESIGN/dashboard-implementation-plan.md)** — Week-by-week breakdown

---

## 🔄 Development Workflow

### Code Reuse Strategy
Leveraging existing weather report code (`generate-weather-report-v5.js`):
- Refactor proven scrapers → Python modules
- Reuse Para-Index calculation (production-validated)
- Reuse scheduler logic
- **Savings:** 15-20 hours + 2 weeks timeline

📖 **Details:** [CODE-REUSE-PLAN.md](docs/PHASE-1-DESIGN/CODE-REUSE-PLAN.md)

### Git Workflow
```bash
# Setup
git clone https://github.com/yourusername/dashboard-parapente.git
cd dashboard-parapente
git checkout -b phase-2-backend

# Phase 2 work
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Commit regularly
git add .
git commit -m "Phase 2: Implement Open-Meteo scraper"
git push origin phase-2-backend

# Create PR when ready
```

### Branch Strategy
- `main` — Production (launch May 10)
- `develop` — Integration branch
- `phase-2-backend` — Current development
- `feature/*` — Individual features

---

## 🗄️ Database

**SQLite** (single local file)
- Location: `backend/db/dashboard.db`
- Schema: `docs/PHASE-1-DESIGN/dashboard-schema-sqlite.sql`
- 12 tables, fully normalized
- Ready for migration to PostgreSQL if scaling needed

### Setup
```bash
cd backend
sqlite3 db/dashboard.db < ../docs/PHASE-1-DESIGN/dashboard-schema-sqlite.sql
```

### Backup
```bash
# Daily automatic backup
cp backend/db/dashboard.db backend/db/backups/dashboard-$(date +%Y%m%d).db
```

---

## 🧪 Testing

```bash
# Backend
cd backend
pytest tests/ -v --cov=scrapers,pipeline,api

# Frontend
cd frontend
npm run test
```

---

## 🔐 Security

- API keys in `.env` (never in git)
- HTTPS enforced (production)
- Input validation on all endpoints
- CORS properly configured
- Rate limiting enabled

---

## 📞 Support

- **Questions?** Check the detailed plan: `docs/PHASE-1-DESIGN/dashboard-implementation-plan.md`
- **Code reuse details:** `docs/PHASE-1-DESIGN/CODE-REUSE-PLAN.md`
- **Database schema:** `docs/PHASE-1-DESIGN/dashboard-schema-sqlite.sql`
- **API endpoints:** `docs/PHASE-1-DESIGN/dashboard-api-spec.md`

---

## 📄 License

BSD-3-Clause License

---

## 🪂 For Vincent

This is your personal paragliding weather dashboard. All code, decisions, and data are yours.

**Timeline:** ~9 weeks from now (May 10, 2026)  
**Investment:** ~70-80 hours total (you + Claw)  
**Payoff:** Custom flying conditions dashboard optimized for your region + learning analytics

Let's build this! 🚀

---

**Last updated:** 2026-02-26  
**Phase:** 1 Design Complete → Phase 2 Backend (Starting March 1)
