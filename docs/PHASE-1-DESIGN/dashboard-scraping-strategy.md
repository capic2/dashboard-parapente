# Dashboard Parapente - Scraping Strategy

**Version:** 1.0  
**Status:** Design Phase  
**Date:** 2026-02-26  
**Author:** Claw, for Vincent  

---

## Executive Summary

This document outlines the **multi-source weather data scraping strategy** for Vincent's personal paragliding dashboard. It covers:

- **8 weather data sources** (3 active, 5 planned)
- **4 scraping architectures** (API, HTML/Playwright, RSS feeds, hybrid)
- **Data extraction pipelines** for each source
- **Scheduling & rate limiting** (respect API/site terms)
- **Error handling & fallback strategies**
- **Phase-based implementation roadmap**

---

## Table of Contents

1. [Overview](#overview)
2. [Scraping Architecture](#scraping-architecture)
3. [Source-by-Source Strategy](#source-by-source-strategy)
4. [Data Pipeline](#data-pipeline)
5. [Error Handling & Resilience](#error-handling--resilience)
6. [Rate Limiting & Ethics](#rate-limiting--ethics)
7. [Implementation Phases](#implementation-phases)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Overview

### Goals

- **Aggregate** weather data from 8 sources into a single unified view
- **Normalize** data formats (API JSON, HTML, RSS) into consistent database schema
- **Minimize** redundant requests (caching, smart scheduling)
- **Respect** rate limits and terms of service for all sources
- **Enable** real-time alerts based on condition thresholds

### Active Sites (Phase 1)

| Site | Elevation | Latitude | Longitude | Status |
|------|-----------|----------|-----------|--------|
| Arguel | 427m | 47.2823 | 6.1742 | ✓ Data |
| Mont Poupet | 842m | 47.2247 | 6.2045 | ✓ Data |
| La Côte | 800m | 47.2567 | 6.1856 | ✓ Data |

### Data Freshness Requirements

| Use Case | Freshness | Frequency |
|----------|-----------|-----------|
| Dashboard display | 30 min | Every 30 min |
| Real-time alerts | 5 min | Every 5 min |
| Historical analysis | Daily | Once per day |

---

## Scraping Architecture

### Four Strategies

```
┌─────────────────────────────────────────────────────┐
│              WEATHER DATA SOURCES                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  API (Direct JSON)          HTML Scraping           │
│  ├─ Open-Meteo              ├─ Meteoblue            │
│  └─ WeatherAPI              ├─ Météo-parapente      │
│                             ├─ Météociel            │
│                             ├─ Parapente.net        │
│                             └─ Planète-Voile        │
│                                                     │
│  RSS/Feed                   Hybrid                   │
│  ├─ Some sources            ├─ Windy (map + API)     │
│  └─ Future: Alerts          └─ Custom parsers        │
│                                                     │
└─────────────────────────────────────────────────────┘

                          ↓

           ┌──────────────────────────┐
           │  NORMALIZATION LAYER     │
           │  (Extract → Transform)   │
           └──────────────────────────┘

                          ↓

           ┌──────────────────────────┐
           │  DATABASE (PostgreSQL)   │
           │  weather_forecasts       │
           │  weather_history         │
           └──────────────────────────┘

                          ↓

      ┌────────────────────────────────┐
      │   DASHBOARD / API / ALERTS     │
      └────────────────────────────────┘
```

---

## Source-by-Source Strategy

### 1. Open-Meteo ✓ (Phase 1 - ACTIVE)

**Type:** REST API (free, no key required)  
**Endpoint:** `https://api.open-meteo.com/v1/forecast`  
**Rate Limit:** None (unlimited for free tier)  
**Update Frequency:** Every 30 minutes  

#### Data Available

```json
Parameters:
{
  "latitude": 47.2823,
  "longitude": 6.1742,
  "hourly": ["temperature_2m", "relative_humidity_2m", "weather_code", "wind_speed_10m", "wind_direction_10m", "precipitation"],
  "daily": ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum"],
  "timezone": "Europe/Paris"
}
```

#### Extraction Logic

```python
# Pseudo-code
import requests

def scrape_openmeteo(lat, lon):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m"],
        "daily": ["temperature_2m_max", "temperature_2m_min"],
        "timezone": "Europe/Paris"
    }
    response = requests.get(url, params=params)
    data = response.json()
    
    # Extract and normalize
    forecasts = []
    for i, timestamp in enumerate(data['hourly']['time']):
        forecast = {
            'site_id': site_id,
            'source_id': 'open-meteo',
            'forecast_date': timestamp.date(),
            'forecast_time': timestamp.time(),
            'temperature_c': data['hourly']['temperature_2m'][i],
            'humidity_percent': data['hourly']['relative_humidity_2m'][i],
            'wind_speed_kmh': data['hourly']['wind_speed_10m'][i],
            'wind_direction_deg': data['hourly']['wind_direction_10m'][i],
            'para_index': calculate_para_index(data, i)  # See calculation below
        }
        forecasts.append(forecast)
    
    return forecasts
```

#### Para-Index Calculation (Composite Score)

```python
def calculate_para_index(source_data, hourly_index):
    """
    Combines multiple factors into a 0-100 score for flying conditions.
    
    Formula:
    para_index = (
        (1 - abs(wind_speed - 12) / 20) * 40 +  # Ideal wind: 10-15 km/h
        (100 - cloud_cover) * 0.2 +               # Clear skies preferred
        (1 - abs(temp - 15) / 20) * 20 +          # Ideal temp: 12-18°C
        thermal_index * 20                        # Thermal strength
    )
    """
    wind = source_data['hourly']['wind_speed_10m'][hourly_index]
    cloud = source_data['hourly']['cloud_cover'][hourly_index]
    temp = source_data['hourly']['temperature_2m'][hourly_index]
    
    # Wind score (20 km/h max, centered at 12 km/h)
    wind_score = max(0, (1 - abs(wind - 12) / 20)) * 40
    
    # Cloud score (0 clouds = 20, 100 clouds = 0)
    cloud_score = (100 - cloud) * 0.2
    
    # Temperature score (optimal 12-18°C)
    temp_score = max(0, (1 - abs(temp - 15) / 20)) * 20
    
    # Thermal estimate (hour of day + season)
    thermal_score = estimate_thermals(hourly_index) * 20
    
    para_index = max(0, min(100, wind_score + cloud_score + temp_score + thermal_score))
    return para_index
```

---

### 2. WeatherAPI ✓ (Phase 1 - ACTIVE)

**Type:** REST API (freemium, key required)  
**Endpoint:** `https://api.weatherapi.com/v1/forecast.json`  
**Rate Limit:** 1,000 calls/day (free tier)  
**Update Frequency:** Every 60 minutes  
**Key Location:** `~/.openclaw/config/weatherapi.key`  

#### Data Available

```json
Parameters:
{
  "key": "YOUR_KEY",
  "q": "47.2823,6.1742",
  "days": 7,
  "aqi": "yes",
  "alerts": "yes"
}
```

#### Extraction Logic

```python
def scrape_weatherapi(lat, lon, api_key):
    url = "https://api.weatherapi.com/v1/forecast.json"
    params = {
        "key": api_key,
        "q": f"{lat},{lon}",
        "days": 7,
        "aqi": "yes",
        "alerts": "yes"
    }
    response = requests.get(url, params=params)
    data = response.json()
    
    forecasts = []
    for day in data['forecast']['forecastday']:
        for hour in day['hour']:
            forecast = {
                'site_id': site_id,
                'source_id': 'weatherapi',
                'forecast_date': day['date'],
                'forecast_time': hour['time'].split()[1],
                'temperature_c': hour['temp_c'],
                'humidity_percent': hour['humidity'],
                'wind_speed_kmh': hour['wind_kph'],
                'wind_direction_deg': hour['wind_degree'],
                'wind_gust_kmh': hour['gust_kph'],
                'pressure_hpa': hour['pressure_mb'],
                'precipitation_mm': hour['precip_mm'],
                'precipitation_probability': hour['chance_of_rain'],
                'cloud_cover_percent': hour['cloud'],
                'uv_index': hour['uv'],
                'visibility_km': hour['vis_km'],
                'para_index': calculate_para_index_weatherapi(hour)
            }
            forecasts.append(forecast)
    
    return forecasts
```

---

### 3. Meteoblue ✓ (Phase 1 - ACTIVE via Playwright)

**Type:** HTML Scraping (Playwright-based)  
**URL:** `https://www.meteoblue.com/en/weather/forecast/[...]/[LAT],[LON]/[ELEVATION]`  
**Rate Limit:** ~1 request every 5 minutes (respect robots.txt)  
**Update Frequency:** Every 120 minutes  
**Why Scraping:** Professional weather with multiple model comparisons (ICON, GFS, NEMS)  

#### Playwright Setup

```python
from playwright.async_api import async_playwright
import asyncio

async def scrape_meteoblue(lat, lon, elevation, site_name):
    """
    Scrapes Meteoblue for professional weather data.
    Returns structured forecast including model ensemble.
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Build Meteoblue URL
        url = f"https://www.meteoblue.com/en/weather/forecast/3columns/{lat},{lon}/{elevation}"
        
        # Navigate and wait for dynamic content
        await page.goto(url, wait_until="networkidle")
        await page.wait_for_timeout(3000)  # Wait for chart rendering
        
        # Extract hourly forecast table
        forecast_rows = await page.query_selector_all("table.forecast tr")
        
        forecasts = []
        for row in forecast_rows:
            cells = await row.query_selector_all("td")
            if len(cells) >= 10:
                forecast = {
                    'site_id': site_id,
                    'source_id': 'meteoblue',
                    'forecast_date': await cells[0].inner_text(),
                    'forecast_time': await cells[1].inner_text(),
                    'temperature_c': float(await cells[2].inner_text()),
                    'wind_speed_kmh': float(await cells[4].inner_text()),
                    'wind_direction_deg': parse_wind_dir(await cells[5].inner_text()),
                    'precipitation_mm': float(await cells[6].inner_text()),
                    'model_icon': await extract_model_data(cells[8], 'ICON'),  # Ensemble
                    'model_gfs': await extract_model_data(cells[9], 'GFS'),
                }
                forecasts.append(forecast)
        
        await browser.close()
        return forecasts

async def main():
    forecasts = await scrape_meteoblue(47.2823, 6.1742, 427, "Arguel")
    await save_to_database(forecasts)

asyncio.run(main())
```

#### Model Weighting

Meteoblue provides multiple models. Use weighted consensus:

```python
def meteoblue_ensemble_forecast(forecasts):
    """
    Combines ICON (60%), GFS (30%), NEMS (10%) into consensus forecast.
    """
    consensus = {
        'temperature_c': (
            forecasts['icon'].temp * 0.6 +
            forecasts['gfs'].temp * 0.3 +
            forecasts['nems'].temp * 0.1
        ),
        'wind_speed_kmh': (
            forecasts['icon'].wind * 0.6 +
            forecasts['gfs'].wind * 0.3 +
            forecasts['nems'].wind * 0.1
        ),
        'confidence_percent': calculate_ensemble_spread(forecasts)
    }
    return consensus
```

---

### 4. Météo-parapente ✓ (Phase 1 - ACTIVE via RSS/HTML)

**Type:** RSS Feed + HTML Scraping  
**URL:** `https://www.meteo-parapente.com`  
**Rate Limit:** 1 request per site per hour (very respectful)  
**Update Frequency:** Every 180 minutes  
**Advantage:** **Paragliding-specific** data (thermals, stability, convergences)  

#### RSS Feed Strategy

```python
import feedparser

def scrape_meteo_parapente_rss():
    """
    Parses Météo-parapente RSS feed for site-specific alerts.
    """
    feed_url = "https://www.meteo-parapente.com/rss/forecasts"
    feed = feedparser.parse(feed_url)
    
    forecasts = {}
    for entry in feed.entries:
        # Entry format: "Arguel - 27 fév: Thermiques 7/10, Stabilité 6/10, Vent 12 km/h"
        site_name = entry.title.split(' - ')[0]
        
        forecasts[site_name] = {
            'thermal_index': extract_value(entry.summary, 'Thermiques', 10),
            'stability_index': extract_value(entry.summary, 'Stabilité', 10),
            'wind_speed_kmh': extract_value(entry.summary, 'Vent', 50),
            'updated_at': entry.published_parsed
        }
    
    return forecasts

def extract_value(text, keyword, max_value):
    """Extract numeric value from French text."""
    import re
    match = re.search(f"{keyword}\\s+(\\d+)", text)
    return int(match.group(1)) if match else None
```

#### HTML Scraping (Fallback)

```python
from bs4 import BeautifulSoup
import requests

def scrape_meteo_parapente_html(site_code):
    """
    Scrapes detailed Meteö-parapente forecast page.
    Returns thermal/stability forecasts for next 7 days.
    """
    url = f"https://www.meteo-parapente.com/forecast/{site_code}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    }
    
    response = requests.get(url, headers=headers, timeout=15)
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Find forecast table
    table = soup.find('table', {'class': 'forecast-table'})
    
    forecasts = []
    for row in table.find_all('tr')[1:]:  # Skip header
        cells = row.find_all('td')
        
        forecast = {
            'site_id': site_id,
            'source_id': 'meteo-parapente',
            'forecast_date': cells[0].text.strip(),
            'thermal_index': int(cells[1].text) / 10,  # Convert 0-10 scale
            'stability_index': int(cells[2].text) / 10,
            'wind_speed_kmh': int(cells[3].text.split()[0]),
            'lift_expectation': cells[4].text.strip(),  # "Excellent", "Bon", etc.
        }
        forecasts.append(forecast)
    
    return forecasts
```

---

### 5. Météociel (Phase 1 - ACTIVE via HTML)

**Type:** HTML Scraping  
**URL:** `https://www.meteociel.fr`  
**Rate Limit:** Very respectful (1 req/10 min per site)  
**Update Frequency:** Every 180 minutes  
**Data:** French meteorological data, model charts  

#### HTML Extraction

```python
def scrape_meteociel(lat, lon, site_name):
    """
    Scrapes Meteociel for archived GFS model data.
    """
    import requests
    from bs4 import BeautifulSoup
    
    # Meteociel uses lat/lon in custom format
    url = f"https://www.meteociel.fr/modeles/gfs/gfs.php?lat={lat}&lon={lon}&mode=1"
    
    response = requests.get(url, timeout=15)
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # GFS data is in HTML table
    tables = soup.find_all('table', {'class': 'modeldata'})
    
    forecasts = []
    for table in tables:
        rows = table.find_all('tr')
        for row in rows[2:]:  # Skip headers
            cells = row.find_all('td')
            
            if len(cells) >= 8:
                forecast = {
                    'site_id': site_id,
                    'source_id': 'meteociel',
                    'forecast_date': cells[0].text,
                    'forecast_time': cells[1].text,
                    'temperature_c': float(cells[2].text),
                    'humidity_percent': int(cells[3].text),
                    'wind_speed_kmh': float(cells[4].text),
                    'precipitation_mm': float(cells[6].text),
                    'para_index': calculate_para_index_meteociel(cells)
                }
                forecasts.append(forecast)
    
    return forecasts
```

---

### 6. Parapente.net (Phase 2 - PLANNED)

**Type:** HTML Scraping (French paragliding forum/portal)  
**URL:** `https://www.parapente.net/`  
**Update Frequency:** Daily (forum posts are less frequent)  
**Challenge:** Dynamic JavaScript rendering, forum structure  

#### Planned Approach

```python
async def scrape_parapente_net(site_name):
    """
    Scrapes Parapente.net forum for flight conditions discussion.
    Extracts user-reported conditions and experience summaries.
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Navigate to site conditions forum
        await page.goto(f"https://www.parapente.net/f-conditions/{site_name}")
        await page.wait_for_load_state("networkidle")
        
        # Extract recent posts
        posts = await page.query_selector_all("article.forum-post")
        
        conditions = []
        for post in posts[:5]:  # Last 5 posts
            title = await post.query_selector(".post-title").inner_text()
            content = await post.query_selector(".post-content").inner_text()
            author = await post.query_selector(".author-name").inner_text()
            date = await post.query_selector(".post-date").inner_text()
            
            # Parse user-reported conditions
            user_experience = {
                'site_id': site_id,
                'source_id': 'parapente-net',
                'title': title,
                'author': author,
                'reported_date': date,
                'conditions_summary': content,
                'sentiment': analyze_sentiment(content),  # Positive/Negative/Neutral
            }
            conditions.append(user_experience)
        
        await browser.close()
        return conditions
```

---

### 7. Windy (Phase 2 - PLANNED)

**Type:** Hybrid (API + Map visualization)  
**URL:** `https://www.windy.com/`  
**Approach:** 
1. Use Windy's public API (if available) for wind data
2. Fallback to scraping their visualization layer (complex, requires Playwright)

#### API Approach (If Available)

```python
def scrape_windy_api(lat, lon, api_key):
    """
    Windy provides wind forecast via their API (requires registration).
    """
    url = "https://api.windy.com/api/v2/point"
    
    params = {
        "lat": lat,
        "lon": lon,
        "key": api_key,
        "model": "gfs"  # GFS model
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    # Extract wind data
    forecasts = []
    for forecast in data['forecast']:
        forecasts.append({
            'site_id': site_id,
            'source_id': 'windy',
            'forecast_date': forecast['date'],
            'wind_speed_kmh': forecast['wind']['speed'] * 3.6,  # m/s to km/h
            'wind_direction_deg': forecast['wind']['direction'],
            'gust_kmh': forecast['gust']['speed'] * 3.6 if 'gust' in forecast else None,
        })
    
    return forecasts
```

#### Visualization Scraping (Fallback)

```python
async def scrape_windy_visualization(lat, lon):
    """
    Scrapes Windy's interactive map for wind forecast.
    More reliable than API for non-commercial use.
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Navigate to Windy forecast
        url = f"https://www.windy.com/?{lat},{lon},5"
        await page.goto(url)
        
        # Wait for forecast data to load
        await page.wait_for_timeout(5000)
        
        # Extract data from page context
        forecast_data = await page.evaluate("""
            () => {
              return {
                wind_speed: document.querySelector('[class*="wind-speed"]').innerText,
                wind_direction: document.querySelector('[class*="wind-direction"]').innerText,
                gusts: document.querySelector('[class*="gusts"]').innerText,
              }
            }
        """)
        
        return forecast_data
```

---

### 8. Planète-Voile (Phase 3 - PLANNED)

**Type:** HTML Scraping (Sailing/Wind conditions)  
**URL:** `https://www.planete-voile.com`  
**Use Case:** Secondary wind/weather source for cross-validation  
**Update Frequency:** Daily  

#### Planned Implementation

```python
def scrape_planete_voile(lat, lon):
    """
    Scrapes Planète-Voile for sailing/wind condition forecasts.
    Complements paragliding forecasts with marine wind data.
    """
    import requests
    from bs4 import BeautifulSoup
    
    # Planète-Voile requires location search first
    search_url = "https://www.planete-voile.com/search"
    search_params = {"q": f"{lat},{lon}"}
    
    response = requests.post(search_url, data=search_params)
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Find location link
    location_link = soup.find('a', {'class': 'location-result'})
    if location_link:
        forecast_url = location_link['href']
        
        forecast_response = requests.get(forecast_url)
        forecast_soup = BeautifulSoup(forecast_response.content, 'html.parser')
        
        # Extract wind/pressure forecast
        forecasts = []
        for row in forecast_soup.find_all('tr', {'class': 'forecast-row'}):
            cells = row.find_all('td')
            
            forecast = {
                'site_id': site_id,
                'source_id': 'planete-voile',
                'forecast_date': cells[0].text,
                'wind_speed_kmh': float(cells[1].text),
                'wind_direction_deg': parse_compass(cells[2].text),
                'pressure_hpa': float(cells[3].text),
            }
            forecasts.append(forecast)
        
        return forecasts
    return []
```

---

## Data Pipeline

### Normalization Flow

```
Raw Data from Source
        ↓
    Extract (source-specific)
        ↓
    Validate (schema, ranges)
        ↓
    Transform (to standard units)
        ↓
    Deduplicate (same forecast, multiple sources)
        ↓
    Calculate Para-Index (unified scoring)
        ↓
    Store in Database
        ↓
    Trigger Alerts (if threshold exceeded)
```

### Example Pipeline Implementation

```python
class WeatherPipeline:
    def __init__(self, db):
        self.db = db
        self.sources = {
            'open-meteo': OpenMeteoScraper(),
            'weatherapi': WeatherAPIScraper(),
            'meteoblue': MetablueScaper(),
            # ... etc
        }
    
    async def fetch_all_sources(self, site_id):
        """
        Concurrently fetch from all sources.
        Returns list of normalized forecasts.
        """
        tasks = [
            self.fetch_and_normalize(source, site_id)
            for source in self.sources.values()
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out failures, keep successes
        forecasts = [r for r in results if not isinstance(r, Exception)]
        
        return forecasts
    
    async def fetch_and_normalize(self, scraper, site_id):
        """Fetch, validate, and normalize single source."""
        try:
            raw_data = await scraper.fetch(site_id)
            validated = self.validate(raw_data)
            normalized = self.normalize(validated)
            return normalized
        except Exception as e:
            logger.error(f"Error fetching {scraper.source}: {e}")
            return None
    
    def normalize(self, data):
        """Convert all units to metric, standardize field names."""
        return {
            'temperature_c': data.get('temp_c') or data.get('température'),
            'wind_speed_kmh': data.get('wind_kph', 0) * 1.60934 if 'wind_kph' in data else data.get('wind_kmh'),
            'para_index': calculate_para_index(data),
        }
    
    async def save_batch(self, forecasts):
        """Insert all forecasts into database."""
        for forecast in forecasts:
            self.db.insert_forecast(forecast)
        
        # Trigger alert checks
        await self.check_alerts(forecasts)
```

---

## Error Handling & Resilience

### Failure Modes & Responses

| Failure | Code | Strategy |
|---------|------|----------|
| **API Down** | 503 | Use cached data, alert admin |
| **Slow Response** | Timeout | Fallback to prev forecast |
| **Invalid Data** | Bad schema | Log & skip, use other sources |
| **Rate Limited** | 429 | Exponential backoff, queue job |
| **Auth Failed** | 401 | Rotate keys, notify |

### Retry Logic

```python
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
async def fetch_with_retry(url, timeout=30):
    """Fetch with exponential backoff: 2s, 4s, 8s"""
    try:
        response = await asyncio.wait_for(
            fetch(url),
            timeout=timeout
        )
        return response
    except asyncio.TimeoutError:
        logger.warning(f"Timeout for {url}, retrying...")
        raise
    except Exception as e:
        logger.error(f"Fetch failed: {e}")
        raise
```

### Fallback Strategy

```python
async def get_forecast_with_fallback(site_id):
    """
    Try to get fresh forecast, fallback to cached if needed.
    """
    try:
        # Try to fetch fresh data
        fresh = await fetch_all_sources(site_id)
        
        if fresh and len(fresh) > 0:
            # Save for fallback
            save_cache(site_id, fresh)
            return fresh
    except Exception as e:
        logger.error(f"Error fetching fresh data: {e}")
    
    # Fallback to cached data
    cached = load_cache(site_id)
    if cached and is_recent(cached, hours=6):
        logger.info(f"Using cached forecast for {site_id}")
        return cached
    
    # Last resort: return empty/error state
    logger.error(f"No forecast available for {site_id}")
    return None
```

---

## Rate Limiting & Ethics

### Terms of Service Compliance

| Source | Terms | Rate Limit (Ours) | Justification |
|--------|-------|-------------------|---------------|
| Open-Meteo | Unlimited | Every 30 min | Free tier allows |
| WeatherAPI | 1k/day | Every 60 min (~24/day) | Conservative (⅓ limit) |
| Meteoblue | Respect ToS | Every 2h per site | HTML scraping: 1 req/5min max |
| Météo-parapente | Be nice | Every 3h per site | Community site: minimal impact |
| Météociel | Standard respect | Every 3h per site | Public meteorological data |
| Parapente.net | Community | Once/day | Forum content: low priority |
| Windy | API terms | To be defined | Phase 2 |
| Planète-Voile | Standard | Once/day | Phase 3 |

### Rate Limit Implementation

```python
from ratelimit import limits, sleep_and_retry
import time

class RateLimiter:
    def __init__(self, requests, period_seconds):
        self.requests = requests
        self.period = period_seconds
        self.calls = []
    
    def is_allowed(self):
        now = time.time()
        # Remove old calls outside the period
        self.calls = [t for t in self.calls if now - t < self.period]
        
        if len(self.calls) < self.requests:
            self.calls.append(now)
            return True
        return False
    
    def wait_if_needed(self):
        while not self.is_allowed():
            time.sleep(1)

# Usage
open_meteo_limiter = RateLimiter(1, 1800)  # 1 request every 30 min

async def scrape_open_meteo(site_id):
    open_meteo_limiter.wait_if_needed()
    return await fetch_openmeteo(site_id)
```

### User-Agent Headers

```python
HEADERS = {
    'User-Agent': (
        'ParapenteDashboard/1.0 '
        '(+https://github.com/vincent-paragliding/dashboard) '
        'Contact: vincent@example.com'
    )
}
```

---

## Implementation Phases

### Phase 1: Design (Current) ✓

- [x] Schema design
- [x] API specification
- [x] Frontend prototype
- [x] Scraping strategy (this document)
- [x] Architecture diagrams

**Deliverables:**
- Design documents (5 files)
- No code implementation yet

**Timeline:** 2026-02-26 (today)

---

### Phase 2: Backend Data (Estimated: 3-4 weeks)

**Scope:**
- Set up PostgreSQL database from schema
- Implement 5 sources (Open-Meteo, WeatherAPI, Meteoblue, Météo-parapente, Météociel)
- Build data pipeline (extract → normalize → store)
- Implement caching & fallback logic
- Create initial scheduler (cron/APScheduler)

**Tasks:**
1. Database initialization & migrations (2-3 days)
2. API client libraries for each source (1 week)
3. HTML scraper for Meteoblue/Meteociel (1 week)
4. Normalization & Para-Index calculation (2-3 days)
5. Testing & error handling (1 week)

**Deliverables:**
- Running PostgreSQL with schema
- Scheduler fetching from 5 sources
- Database populated with 7-day forecasts
- Unit tests for scrapers

**Skills Needed:**
- Python (async/await, requests/Playwright)
- PostgreSQL (migrations, indexes)
- Docker (for consistent environment)

---

### Phase 3: Frontend + Polish (Estimated: 2-3 weeks)

**Scope:**
- Convert HTML prototype to real frontend (Vue.js/React)
- Implement dashboard endpoints (GET /dashboard, /weather/current, etc.)
- Build alert management UI
- Integrate Strava sync
- Deploy to OpenClaw infrastructure

**Tasks:**
1. Frontend framework setup (Vue/React) (2-3 days)
2. API integration (dashboard, forecasts, flights) (1 week)
3. Real-time updates (WebSocket/polling) (2-3 days)
4. User preferences & settings (2-3 days)
5. Testing & deployment (1 week)

**Deliverables:**
- Live dashboard at `https://dashboard.parapente.local`
- Working Strava integration
- Alert notifications (Telegram/Email)
- Mobile-responsive design

---

### Phase 4: Advanced Features (Future)

- [ ] Machine learning forecast accuracy scoring
- [ ] Social features (share flights, compare conditions)
- [ ] Mobile app (React Native)
- [ ] Integration with Windy API
- [ ] Parapente.net scraping
- [ ] Planète-Voile integration
- [ ] Export to GPX/KML
- [ ] Advanced analytics dashboard

---

## Monitoring & Maintenance

### Health Checks

```python
async def health_check():
    """
    Runs every 5 minutes, reports scraper health.
    """
    status = {
        'timestamp': datetime.now(),
        'sources': {}
    }
    
    for source_name, scraper in scrapers.items():
        last_run = db.get_last_scrape_time(source_name)
        is_healthy = (
            last_run and 
            (datetime.now() - last_run).seconds < 3600 and  # Less than 1h old
            not scraper.last_error
        )
        
        status['sources'][source_name] = {
            'healthy': is_healthy,
            'last_run': last_run,
            'error': scraper.last_error,
            'records_fetched': scraper.last_record_count
        }
    
    # Send to monitoring
    send_to_monitoring(status)
    return status
```

### Logging

```python
import logging

logging.basicConfig(
    filename='/var/log/dashboard/scraping.log',
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger('dashboard.scraping')

# Usage
logger.info(f"Fetched {len(forecasts)} forecasts from Open-Meteo")
logger.warning(f"Meteoblue request timed out, using cache")
logger.error(f"WeatherAPI key invalid, skipping source")
```

### Metrics to Track

- **Source availability** (uptime %)
- **Data freshness** (last update time)
- **Accuracy** (forecast vs. actual conditions)
- **Request latency** (avg time per source)
- **Error rate** (failed requests / total requests)

---

## Conclusion

This scraping strategy provides:

✅ **Diversity** — 8 sources reduces dependence on any single provider  
✅ **Resilience** — Fallbacks, retries, caching, error handling  
✅ **Ethics** — Respects rate limits and terms of service  
✅ **Scalability** — Can add sources/sites without major refactoring  
✅ **Accuracy** — Multi-source consensus & Para-Index weighting  

**Next Steps:**
1. Review & approve this strategy
2. Begin Phase 2 backend development
3. Set up development database
4. Start with Open-Meteo & WeatherAPI (easiest APIs)
5. Progress to Meteoblue/Météo-parapente scraping

---

**Document End**
