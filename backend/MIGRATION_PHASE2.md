# Migration Guide: Phase 1 → Phase 2

## What Changed

### New Files (7 files)
1. `weather_pipeline.py` - Multi-source aggregation
2. `para_index.py` - Scoring algorithm
3. `scheduler.py` - Hourly cron jobs
4. `strava.py` - Strava API client
5. `webhooks.py` - Webhook handlers
6. `test_pipeline.py` - Testing script
7. `PHASE2_SUMMARY.md` - Documentation

### Updated Files (3 files)
1. `main.py` - Added scheduler + webhooks
2. `routes.py` - New weather endpoints
3. `requirements.txt` - Added APScheduler

### Database Schema
**No changes required** - existing schema supports new features.

---

## Breaking Changes

### ⚠️ Weather Endpoint Response Format Changed

**Old (Phase 1)**:
```json
GET /api/weather/arguel
{
  "site_id": "arguel",
  "site_name": "Arguel",
  "forecasts": [
    {
      "id": "uuid",
      "forecast_date": "2026-02-27",
      "wind_avg_kmh": 10.0,
      ...
    }
  ]
}
```

**New (Phase 2)**:
```json
GET /api/weather/arguel?day_index=0
{
  "site_id": "arguel",
  "site_name": "Arguel",
  "day_index": 0,
  "consensus": [
    {
      "hour": 11,
      "temperature": 12.5,
      "wind_speed": 10.2,
      "num_sources": 3,
      ...
    }
  ],
  "para_index": 72,
  "verdict": "BON",
  "emoji": "🟢",
  "explanation": "...",
  "metrics": {...},
  "slots": [...],
  "slots_summary": "..."
}
```

**Migration Strategy**:
- Old endpoint still works (returns DB data)
- New endpoint returns **live** multi-source data
- Frontend should migrate to new format

---

## Step-by-Step Migration

### 1. Backup Current Setup
```bash
cd ~/.openclaw/workspace/paragliding/dashboard/backend

# Backup database
cp db/dashboard.db db/dashboard.db.backup-$(date +%Y%m%d)

# Backup config
cp .env .env.backup
```

### 2. Pull New Code
```bash
git pull origin main
# Or if files were manually created, they're already there
```

### 3. Update Dependencies
```bash
source venv/bin/activate

# Install new dependency (APScheduler)
pip install apscheduler==3.10.4

# Or reinstall all
pip install -r requirements.txt
```

### 4. Update Environment Variables

Add to `.env`:
```bash
# Strava (optional)
STRAVA_CLIENT_ID=your_id
STRAVA_CLIENT_SECRET=your_secret
STRAVA_REFRESH_TOKEN=your_refresh_token
STRAVA_VERIFY_TOKEN=PARAPENTE_2025

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=721260037
```

### 5. Restart API
```bash
# Stop old process
pkill -f "python main.py"

# Start new version
python main.py
```

Scheduler will start automatically on boot.

### 6. Verify Migration

```bash
# Test health check
curl http://localhost:8000/

# Should show v0.2.0 and new features

# Test new weather endpoint
curl http://localhost:8000/api/weather/arguel?day_index=0

# Check scheduler is running
# Look for log: "✅ Weather scheduler started (runs every hour)"
```

---

## Frontend Migration

### Old Code (Phase 1)
```javascript
// Fetch weather
const response = await fetch('/api/weather/arguel');
const data = await response.json();
const forecasts = data.forecasts; // Array of DB records
```

### New Code (Phase 2)
```javascript
// Fetch LIVE weather with Para-Index
const response = await fetch('/api/weather/arguel?day_index=0');
const data = await response.json();

// Display Para-Index
const paraIndex = data.para_index; // 0-100
const verdict = data.verdict; // BON/MOYEN/LIMITE/MAUVAIS
const emoji = data.emoji; // 🟢/🟡/🟠/🔴

// Display hourly data
const hourly = data.consensus; // Array of hours with confidence scores

// Display flyable slots
const slots = data.slots_summary; // "✅ Volable: 11h-16h"
```

### Migration Path Options

**Option A: Full Migration (Recommended)**
- Replace all weather API calls with new format
- Use live multi-source data
- Show Para-Index prominently
- Display confidence indicators

**Option B: Gradual Migration**
- Keep old endpoint for existing views
- Add new "Live Forecast" view with Para-Index
- Migrate components one by one

**Option C: Hybrid**
- Use DB endpoint for historical data
- Use live endpoint for current/tomorrow forecasts

---

## Rollback Plan

If issues arise:

### 1. Restore Database
```bash
cp db/dashboard.db.backup-YYYYMMDD db/dashboard.db
```

### 2. Restore Code
```bash
git checkout phase1-tag
# Or manually restore files
```

### 3. Restore Environment
```bash
cp .env.backup .env
```

### 4. Reinstall Old Dependencies
```bash
pip install -r requirements.txt.backup
```

---

## Testing Checklist

- [ ] API starts without errors
- [ ] Health check shows v0.2.0
- [ ] `/api/spots` returns sites
- [ ] `/api/weather/arguel?day_index=0` returns live forecast
- [ ] Para-Index calculates correctly (0-100 range)
- [ ] Scheduler starts (check logs)
- [ ] Scheduler runs hourly (wait 1 hour or test manually)
- [ ] Database forecasts are created/updated
- [ ] Strava webhook verification works (GET /webhooks/strava)
- [ ] Frontend displays new data correctly

---

## Common Issues

### Issue: Scheduler not running
**Symptom**: No forecasts in database after 1 hour

**Solution**:
```bash
# Check logs for scheduler errors
python main.py 2>&1 | grep scheduler

# Manually trigger to test
python -c "from scheduler import manual_fetch_all; import asyncio; asyncio.run(manual_fetch_all())"
```

### Issue: No weather data
**Symptom**: `"total_sources": 0`

**Solution**:
- Check internet connection
- Verify WeatherAPI key is valid
- Check scraper logs for errors
- Test individual scrapers:
```python
from scrapers.open_meteo import fetch_open_meteo
import asyncio
result = asyncio.run(fetch_open_meteo(46.98897, 5.82095))
print(result)
```

### Issue: Strava webhook not working
**Symptom**: Activities not imported

**Solution**:
- Verify webhook is registered with Strava
- Check signature validation
- Test with curl:
```bash
curl -X POST http://localhost:8000/webhooks/strava \
  -H "Content-Type: application/json" \
  -d '{"object_type":"activity","aspect_type":"create","object_id":123}'
```

### Issue: Frontend shows old data
**Symptom**: No Para-Index visible

**Solution**:
- Clear browser cache
- Check frontend is calling new endpoint
- Verify API response format

---

## Performance Comparison

| Metric | Phase 1 | Phase 2 | Change |
|--------|---------|---------|--------|
| Weather sources | 1 | 4 | +300% |
| Data freshness | DB cached | Live | Real-time |
| Scoring | None | Para-Index | New |
| Confidence | No | Yes | New |
| Auto-updates | Manual | Hourly | Automated |
| Strava integration | No | Yes | New |

---

## Support

If migration fails:
1. Check logs: `python main.py 2>&1 > api.log`
2. Review `PHASE2_SUMMARY.md` for architecture details
3. Review `QUICKSTART_PHASE2.md` for setup instructions
4. Create GitHub issue with logs

---

**Migration Duration**: ~15 minutes  
**Downtime**: ~2 minutes (restart only)  
**Risk Level**: Low (backward compatible DB schema)
