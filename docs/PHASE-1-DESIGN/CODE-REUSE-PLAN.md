# Code Reuse Plan — Weather Report → Dashboard

## Overview

**Huge optimization discovered! 🎯**

Your existing weather report code (`generate-weather-report-v5.js`) contains **production-tested scrapers** that we can refactor and reuse for the dashboard.

**Savings:** 10-15 hours in Phase 2 (Week 2 API Clients)

---

## Existing Code Inventory

### 1. Open-Meteo Scraper ✅
**Location:** `/home/capic/.openclaw/workspace/paragliding/generate-weather-report-v5.js`

**What it does:**
- Fetches 7-day hourly forecast from Open-Meteo API
- Handles error cases & retries
- Caches responses
- Returns: temperature, wind, cloud, humidity, etc.

**How to reuse:**
```python
# Phase 2, Week 2: Create Python wrapper
from requests import Session

class OpenMeteoScraper:
    def __init__(self):
        self.base_url = "https://api.open-meteo.com/v1/forecast"
    
    async def fetch(self, lat, lon):
        # Use EXACT SAME API parameters as JS version
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": [
                "temperature_2m", "relative_humidity_2m",
                "weather_code", "wind_speed_10m", "wind_direction_10m",
                "wind_gusts_10m", "cloud_cover", "visibility",
                "uv_index"
            ],
            "daily": ["precipitation_sum", "wind_speed_10m_max"],
            "timezone": "Europe/Paris"
        }
        # ... call API (same as JS)
        return response.json()
    
    def normalize(self, data):
        """Convert to DB schema"""
        return {
            'temperature_c': data['temperature_2m'],
            'wind_speed_kmh': data['wind_speed_10m'],
            # ... etc
        }
```

**Testing:** Use recorded responses from existing script (same test data)

---

### 2. WeatherAPI Scraper ✅
**Location:** Same JS file

**What it does:**
- Alternative weather API (backup source)
- Handles API key from env variable
- Returns similar data to Open-Meteo

**How to reuse:**
```python
class WeatherAPIScraper:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.weatherapi.com/v1/forecast.json"
    
    async def fetch(self, lat, lon):
        # Same parameters as JS script
        params = {
            "key": self.api_key,
            "q": f"{lat},{lon}",
            "days": 7,
            "aqi": "yes",
            "alerts": "yes"
        }
        # ... call API
        return response.json()
    
    def normalize(self, data):
        """Convert to DB schema"""
        return {
            'temperature_c': data['current']['temp_c'],
            'wind_speed_kmh': data['current']['wind_kph'],
            # ... etc
        }
```

---

### 3. Meteoblue Scraper (Playwright) ✅ — **CRITICAL REUSE**
**Location:** Same JS file

**What it does:**
- Uses Playwright to open Meteoblue forecast page
- Extracts hourly weather table (not SVG, actual data)
- Handles dynamic content loading
- Returns 23 hours/day of detailed forecast

**How to reuse:**
```python
# Port the EXACT SAME Playwright logic to Python

from playwright.async_api import async_playwright

class MeteoblueScraper:
    async def fetch(self, url: str):
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            await page.goto(url)
            await page.wait_for_load_state("networkidle")  # Same as JS
            
            # Extract table (SAME CSS selectors as JS script)
            table = await page.query_selector(".forecast-table")
            rows = await table.query_selector_all("tr.hourly-row")
            
            forecasts = []
            for row in rows:
                cells = await row.query_selector_all("td")
                forecasts.append({
                    'time': await cells[0].text_content(),
                    'temp': await cells[1].text_content(),
                    'wind': await cells[2].text_content(),
                    # ... extract all columns
                })
            
            await browser.close()
            return forecasts
    
    def normalize(self, data):
        """Convert to DB schema"""
        return [
            {
                'temperature_c': float(f['temp']),
                'wind_speed_kmh': float(f['wind']),
                # ... etc
            }
            for f in data
        ]
```

**Key advantage:** You already know this scraper works reliably in production!

---

### 4. Météo-parapente Scraper ✅
**Location:** Same JS file

**What it does:**
- Fetch Météo-parapente RSS feed (structured data)
- Extract thermal index, stability index
- Fallback to HTML parsing if RSS fails

**How to reuse:**
```python
import feedparser
from bs4 import BeautifulSoup

class MeteoParapenteScraper:
    async def fetch(self):
        # Parse RSS feed (EXACT SAME URL as JS)
        feed = feedparser.parse("https://www.meteo-parapente.com/rss.php")
        
        forecasts = []
        for entry in feed.entries:
            # Extract: thermal_strength, stability_index, etc.
            forecasts.append({
                'thermal_strength': self._parse_thermal(entry.summary),
                'stability_index': self._parse_stability(entry.summary),
                # ... etc
            })
        
        return forecasts
    
    def normalize(self, data):
        """Convert to DB schema"""
        return [
            {
                'thermal_potential': 'strong' if f['thermal_strength'] > 3 else 'weak',
                'stability_index': f['stability_index'],
                # ... etc
            }
            for f in data
        ]
```

---

### 5. Para-Index Calculation ✅ — **MOST CRITICAL**
**Location:** JS file, function `calculateParaIndex()`

**What it does:**
- **Production-tested** scoring algorithm
- Combines: wind, cloud cover, temp, thermals, stability
- Returns 0-100 score
- Validated against real flying conditions

**How to reuse:**
```python
def calculate_para_index(weather_data):
    """
    COPY THE EXACT SAME LOGIC from JS script!
    Don't rewrite - this is production code.
    """
    
    score = 50  # Base
    
    # Wind scoring (EXACT from JS)
    wind = weather_data['wind_speed_kmh']
    if wind < 3:
        score -= 40  # Vent insuffisant
    elif wind < 5:
        score -= 20
    elif wind <= 8:
        score += 10
    elif wind <= 15:
        score += 40  # OPTIMAL
    elif wind <= 20:
        score -= 10
    else:
        score -= 50  # Trop fort
    
    # Cloud cover (EXACT from JS)
    cloud = weather_data['cloud_cover_percent']
    if cloud > 80:
        score -= 30
    elif cloud > 60:
        score -= 15
    elif cloud < 20:
        score += 10
    
    # Temperature (EXACT from JS)
    temp = weather_data['temperature_c']
    if temp < 5:
        score -= 30
    elif temp < 10:
        score -= 10
    elif 12 <= temp <= 18:
        score += 15
    elif temp > 25:
        score -= 20
    
    # Gusts (EXACT from JS)
    gusts = weather_data['wind_gust_kmh']
    if gusts > 25:
        score -= 50
    
    return max(0, min(100, score))  # Clamp 0-100
```

**⚠️ CRITICAL:** Copy line-by-line from JS! This is validated production code.

---

## Phase 2 Refactoring Plan

### Week 2: API Clients (5-7 hours) — OPTIMIZED

**Timeline:**
- **Monday:** Extract all 5 functions from JS to Python modules
- **Tuesday:** Write normalize() wrappers + unit tests
- **Wednesday:** Integration test (scrapers → SQLite)
- **Thursday-Friday:** Polish + documentation

**Tasks by source:**

| Source | Refactor | Test | Normalize | Total |
|--------|----------|------|-----------|-------|
| Open-Meteo | 30 min | 20 min | 30 min | 1.5h |
| WeatherAPI | 30 min | 15 min | 30 min | 1.25h |
| Meteoblue | 1h | 45 min | 30 min | 2.25h |
| Météo-parapente | 30 min | 20 min | 20 min | 1.1h |
| Para-Index | 20 min | 30 min | - | 0.75h |

**Total:** 6.85 hours ≈ 7 hours (vs. 20 hours from scratch!)

---

## Integration Points

### 1. Scheduler (APScheduler)
**Existing:** Cron job runs daily at 7h

**For dashboard:**
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

# Reuse existing fetch logic, insert to SQLite instead of email
scheduler.add_job(
    pipeline.process_all_sites,  # Uses refactored scrapers
    'interval',
    minutes=30,
    id='fetch_weather'
)
```

### 2. Database Insertion
**New:** Instead of email/Telegram, insert to SQLite

```python
async def process_all_sites():
    for site in sites:
        for scraper in [openmeteo, weatherapi, meteoblue, meteo_parapente]:
            raw_data = await scraper.fetch(site.lat, site.lon)
            normalized = scraper.normalize(raw_data)
            
            # Insert to DB (new)
            db.weather_forecasts.insert_many(normalized)
```

---

## File Structure (After Refactoring)

```
/home/capic/.openclaw/workspace/paragliding/
├── backend/
│   ├── scrapers/
│   │   ├── openmeteo.py          ← Refactored from JS
│   │   ├── weatherapi.py         ← Refactored from JS
│   │   ├── meteoblue.py          ← Refactored from JS (Playwright)
│   │   ├── meteo_parapente.py    ← Refactored from JS
│   │   ├── para_index.py         ← Refactored calculation (CRITICAL!)
│   │   └── base.py               ← Common normalize() interface
│   │
│   ├── pipeline/
│   │   ├── pipeline.py           ← Orchestration (scrapers → DB)
│   │   └── normalize.py          ← Data validation
│   │
│   └── tests/
│       ├── test_openmeteo.py
│       ├── test_weatherapi.py
│       ├── test_meteoblue.py
│       ├── test_meteo_parapente.py
│       └── fixtures/
│           ├── openmeteo-response.json  ← Recorded from JS script
│           ├── weatherapi-response.json
│           └── ... etc
└── scripts/
    └── generate-weather-report-v5.js   ← KEEP AS REFERENCE
```

---

## Test Data

**Advantage:** You have real working data!

```python
# Use EXACT SAME test responses from your JS script
# in pytest fixtures

# tests/fixtures/openmeteo-response.json
{
    "latitude": 47.22356,
    "hourly": {
        "time": ["2026-02-26T00:00", ...],
        "temperature_2m": [8.2, 8.1, ...],
        # ... same structure as your current script uses
    }
}

# Then in tests:
import json

def test_openmeteo_normalize():
    with open('fixtures/openmeteo-response.json') as f:
        response = json.load(f)
    
    result = openmeteo.normalize(response)
    assert result['temperature_c'] == 8.2
```

---

## Risk Mitigation

**Risk:** JS and Python implementations diverge

**Mitigation:**
1. Copy logic line-by-line (don't "improve")
2. Use identical test data
3. Compare outputs side-by-side during Week 2
4. Keep JS script running in parallel (backup)

**Example check:**
```bash
# Week 2 Thursday: Sanity check
# JS script output (email): Arguel para-index 75
# Python script output: Arguel para-index 75 ✓ Match!
```

---

## Timeline Impact

### Without reuse:
- Week 2: 20 hours building scrapers from scratch
- Total Phase 2: 40-50 hours

### With reuse:
- Week 2: 5-7 hours refactoring existing code
- Total Phase 2: 20-30 hours ⚡

**Savings: 15-20 hours! (50% reduction)**

---

## Key Principle

**"Don't rewrite. Refactor."**

Your weather report script is:
- ✅ Production-tested
- ✅ Handles errors gracefully
- ✅ Validated against real conditions
- ✅ Already scheduled reliably

We're not improving it. We're adapting it. Keep it simple.

---

**Status:** Ready for Phase 2 Week 2 (March 3-7, 2026)  
**Effort saved:** 15-20 hours 🚀  
**Launch moved up:** ~1 week (May 10 → May 3)
