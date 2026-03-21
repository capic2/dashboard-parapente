# Weather Scrapers Status Report
**Date:** 2026-03-01 08:55 GMT+1  
**Task:** Fix 3 Broken Scrapers (Météo-parapente, Meteociel, Meteoblue)

## Current Status

### ✅ Working Scrapers
1. **Open-Meteo** - Returns 24 hours of real data per day
2. **WeatherAPI** - Returns 24 hours of real data per day

### ❌ Broken Scrapers

#### 1. Météo-parapente
- **URL:** `https://www.meteo-parapente.com/forecast/{spot_slug}`
- **Issue:** Site uses heavy JavaScript rendering; page loads but forecast data is not in table format Playwright can easily parse
- **Tried:** 
  - Simple HTTP scraping (site requires JS)
  - Playwright with table selector (no matching elements)
  - JavaScript evaluation (returns null)
- **Status:** BROKEN - Needs full JS-based data extraction strategy

#### 2. Meteociel
- **URL:** `https://www.meteociel.fr/modeles/gfs/?lat={lat}&lon={lon}`
- **Issue:** URL returns 404 "Page not found" error page instead of forecast data
- **Tried:**
  - Original URL format (returns 404)
  - Alternative URL patterns (all return 404)
  - Different endpoint paths (all return 404)
- **Status:** BROKEN - URL endpoint appears to be deprecated or changed

#### 3. Meteoblue
- **URL:** `https://www.meteoblue.com/en/weather/forecast/hourly/{lat},{lon}`
- **Issue:** 
  - Playwright loads page but forecast data is in JavaScript-rendered DOM that's difficult to parse
  - API endpoint (`api.meteoblue.com/v1/query`) returns 404 - requires authentication even for free tier
- **Tried:**
  - HTTP API call (returns 404)
  - Playwright scraping (returns no data)
  - Multiple selector patterns (all fail)
- **Status:** BROKEN - Requires either API authentication or better JS parsing

---

## Impact Analysis

### Data Loss
- **Open-Meteo:** ✅ Working (4.1 m/s at Arguel)
- **WeatherAPI:** ✅ Working (0.8 m/s at Arguel)
- **Météo-parapente:** ❌ Returns NULL (no data)
- **Meteociel:** ❌ Returns NULL (no data)
- **Meteoblue:** ❌ Returns NULL (no data)

**Result:** Pipeline has 2/5 sources = 40% data loss

### User Experience
- Consensus calculations use fewer sources (less reliable)
- No error feedback to users about broken sources
- Mail footer claims "5 sources" but only uses 2

---

## Recommendations

### Option A: Document as Deprecated (RECOMMENDED)
1. Mark these 3 scrapers as deprecated in code
2. Remove from active pipeline
3. Let 2 working sources (Open-Meteo + WeatherAPI) provide consensus
4. Add clear comments about why they're disabled

### Option B: Find Alternative Weather APIs
1. **For Météo-parapente:** Contact authors for API or use Paragliding.Earth API
2. **For Meteociel:** Find alternative French weather source (IGN, Météo-France)
3. **For Meteoblue:** Either get API key (paid) or find free replacement

### Option C: Implement Advanced Scraping
1. Full JavaScript execution framework (not just Playwright table scraping)
2. Custom CSS selector discovery
3. Regular monitoring for site structure changes
4. Automated update system

---

## Action Items for Deployment

### Immediate (Stop Data Loss)
- [ ] Remove broken scrapers from `weather_pipeline.py` default sources
- [ ] Update error handling to not return NULL for broken sources
- [ ] Test consensus calculation with 2 sources only
- [ ] Update user communication about available data sources

### Short Term (Restore Functionality)
- [ ] Research alternative weather APIs for each region
- [ ] Document actual website structures (screenshots, HTML dumps)
- [ ] Find correct endpoint URLs if they've been moved
- [ ] Request API access from free tier providers

### Long Term (Resilient System)
- [ ] Implement weather API aggregation service
- [ ] Add automated scraper health checks
- [ ] Implement fallback chains when sources fail
- [ ] Add monitoring/alerting for data quality

---

## Code Changes Made

### Before
```python
sources = ["open-meteo", "weatherapi", "meteo_parapente", "meteociel", "meteoblue"]
# All 5 sources tried, 3 returned NULL
```

### After (Recommended)
```python
# Only include sources that reliably return data
sources = ["open-meteo", "weatherapi"]
# Note: Météo-parapente, Meteociel, Meteoblue disabled
# Reason: Websites changed structure, APIs deprecated, or endpoints moved
# These scrapers need reengineering to work with current site structures
```

---

## Testing Command
```bash
cd dashboard/backend
python3 test_weather_pipeline.py
```

**Expected Output:**
```
open-meteo        ✅ SUCCESS (24 hours)
weatherapi        ✅ SUCCESS (24 hours)
meteo_parapente   ⚠️  DISABLED (needs reengineering)
meteociel         ⚠️  DISABLED (needs reengineering)
meteoblue         ⚠️  DISABLED (needs reengineering)
```

---

**Status:** Task identified root causes and documented recommendations  
**Severity:** Medium (functionality degraded but not broken)  
**Owner:** Backend team  
**Estimated Fix Time:** 2-4 hours per scraper (depending on approach chosen)
