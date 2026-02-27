# Dashboard Parapente - Phase 2 Quickstart

## What's New in Phase 2

✅ **Multi-source weather aggregation** (4 APIs)  
✅ **Para-Index scoring** (0-100, BON/MOYEN/LIMITE/MAUVAIS)  
✅ **Hourly scheduler** (automatic updates every hour)  
✅ **Strava webhook** (auto-import flights from Strava)  
✅ **Telegram notifications** (new flight alerts)

---

## Prerequisites

- **Python 3.11 or 3.12** (not 3.14 - compatibility issues)
- SQLite
- Git

## Installation

```bash
# Navigate to backend
cd ~/.openclaw/workspace/paragliding/dashboard/backend

# Create venv with Python 3.11/3.12
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers (for Meteoblue scraper)
playwright install chromium
```

## Database Setup

```bash
# Initialize database with default sites
python init_db.py

# This creates:
# - db/dashboard.db
# - 3 default sites (Arguel, Mont Poupet, La Côte)
```

## Environment Variables

Create `.env` in `backend/` directory:

```bash
# Weather APIs
WEATHERAPI_KEY=${WEATHERAPI_KEY}

# Strava (optional, for webhook integration)
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_secret
STRAVA_REFRESH_TOKEN=your_refresh_token
STRAVA_VERIFY_TOKEN=PARAPENTE_2025

# Telegram (optional, for notifications)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=721260037
```

## Running the API

```bash
# Development server
source venv/bin/activate
python main.py

# Production with uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at: **http://localhost:8000**

## Testing the API

### 1. Health Check
```bash
curl http://localhost:8000/
```

Expected response:
```json
{
  "status": "ok",
  "message": "Dashboard Parapente API v0.2.0",
  "features": [
    "Multi-source weather aggregation (4 sources)",
    "Para-Index scoring (0-100)",
    "Hourly scheduler (every hour)",
    "Strava webhook integration",
    "Telegram notifications"
  ]
}
```

### 2. Get Live Weather Forecast
```bash
# Today's forecast for Arguel
curl http://localhost:8000/api/weather/arguel?day_index=0

# Tomorrow's forecast
curl http://localhost:8000/api/weather/arguel?day_index=1
```

Expected response:
```json
{
  "site_id": "arguel",
  "site_name": "Arguel",
  "day_index": 0,
  "consensus": [...hourly data...],
  "para_index": 72,
  "verdict": "BON",
  "emoji": "🟢",
  "explanation": "Vent optimal pour thermiques (10.2 km/h)",
  "metrics": {
    "avg_wind_kmh": 10.2,
    "max_gust_kmh": 18.5,
    "total_rain_mm": 0.0,
    "avg_temp_c": 13.8,
    "avg_lifted_index": -1.2
  },
  "slots_summary": "✅ Volable: 11h-16h\n⭐ Meilleur créneau: 11h-16h",
  "total_sources": 4
}
```

### 3. List All Spots
```bash
curl http://localhost:8000/api/spots
```

### 4. Manual Weather Fetch (Test Scheduler)
```bash
python -c "import asyncio; from scheduler import manual_fetch_all; asyncio.run(manual_fetch_all())"
```

This will:
- Fetch weather for all 3 default sites
- Calculate Para-Index
- Store in database

### 5. Check Stored Forecasts
```bash
# Get stored forecast from database
curl http://localhost:8000/api/weather/arguel
```

## Scheduler

The scheduler runs automatically when the API starts:
- **Frequency**: Every hour at :00 (10:00, 11:00, 12:00, etc.)
- **Sites**: arguel, poupet, cote
- **Days**: Today + Tomorrow
- **Storage**: `weather_forecasts` table

To manually trigger:
```python
from scheduler import manual_fetch_all
import asyncio
asyncio.run(manual_fetch_all())
```

## Strava Webhook Setup

### 1. Register Webhook with Strava

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=YOUR_CLIENT_ID \
  -F client_secret=YOUR_CLIENT_SECRET \
  -F callback_url=https://your-domain.com/webhooks/strava \
  -F verify_token=PARAPENTE_2025
```

### 2. Test Webhook Locally (ngrok)

```bash
# Start ngrok
ngrok http 8000

# Use ngrok URL in callback_url above
# Example: https://abc123.ngrok.io/webhooks/strava
```

### 3. Simulate Webhook (Testing)

```bash
curl -X POST http://localhost:8000/webhooks/strava \
  -H "Content-Type: application/json" \
  -d '{
    "object_type": "activity",
    "aspect_type": "create",
    "object_id": 123456,
    "owner_id": 789
  }'
```

## Troubleshooting

### Python 3.14 Compatibility Issues
**Error**: `greenlet` or `pydantic-core` build fails

**Solution**: Use Python 3.11 or 3.12
```bash
# Remove existing venv
rm -rf venv

# Create new venv with Python 3.11
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Playwright Not Installed
**Error**: `playwright not found`

**Solution**:
```bash
source venv/bin/activate
playwright install chromium
```

### Database Not Found
**Error**: `db/dashboard.db not found`

**Solution**:
```bash
python init_db.py
```

### No Data from Scrapers
**Check logs**:
```bash
# Tail logs when running
python main.py 2>&1 | grep -i error
```

Common issues:
- Rate limiting (WeatherAPI free tier)
- Network issues
- Playwright browser not installed

## File Structure

```
backend/
├── main.py                  # FastAPI app + lifespan
├── routes.py                # API routes (updated)
├── weather_pipeline.py      # Multi-source aggregation
├── para_index.py            # Scoring algorithm
├── scheduler.py             # Hourly cron
├── strava.py                # Strava API integration
├── webhooks.py              # Strava webhook handler
├── database.py              # SQLAlchemy setup
├── models.py                # DB models
├── schemas.py               # Pydantic schemas
├── requirements.txt         # Dependencies (updated)
├── init_db.py               # Database seeding
├── test_pipeline.py         # Quick test script
├── scrapers/
│   ├── open_meteo.py       # Open-Meteo (free)
│   ├── weatherapi.py       # WeatherAPI
│   ├── meteociel.py        # Météociel (scraping)
│   └── meteoblue.py        # Meteoblue (Playwright)
├── db/
│   └── dashboard.db        # SQLite database
└── PHASE2_SUMMARY.md       # This file
```

## API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Next Steps

1. **Frontend Integration**
   - Connect React app to `/api/weather/{spot_id}`
   - Display Para-Index with color-coded badges
   - Show hourly slots timeline

2. **Production Deployment**
   - Set up systemd service
   - Configure reverse proxy (nginx)
   - Enable HTTPS for webhook

3. **Monitoring**
   - Add logging to file
   - Set up error alerts
   - Track API usage

4. **Enhancements**
   - Add more sites
   - Historical data analysis
   - Wind rose diagrams
   - Flight statistics dashboard

---

**Need help?** Check `PHASE2_SUMMARY.md` for detailed architecture.
