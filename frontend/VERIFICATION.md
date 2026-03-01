# Frontend Verification Checklist

Run these checks to verify the dashboard frontend is working correctly.

## ✅ Environment Verification

### 1. Backend API Status
```bash
# Check if backend is running
curl -s http://localhost:8001/api/spots | head -20

# Expected output: JSON with sites array
# {"sites": [...]}
```

### 2. Frontend Build Verification
```bash
cd /home/capic/.openclaw/workspace/paragliding/dashboard/frontend

# Check TypeScript compilation
npm run type-check
# Expected: No output (no errors)

# Check ESLint
npm run lint
# Expected: No critical errors
```

### 3. Docker Containers
```bash
# Check if both containers are running
docker ps | grep dashboard

# Expected output:
# - dashboard-backend (running on port 8001:8000)
# - dashboard-frontend (running on port 5173:5173)
```

## 🌐 API Endpoint Tests

Run these curl commands to verify API integration:

### Test 1: Get All Sites
```bash
curl -s http://localhost:8001/api/spots | python3 -m json.tool

# Expected response:
# {
#   "sites": [
#     {
#       "id": "site-arguel",
#       "name": "Arguel",
#       "elevation_m": 427,
#       ...
#     },
#     ...
#   ]
# }
```

### Test 2: Get Weather for a Site
```bash
curl -s http://localhost:8001/api/weather/site-arguel | python3 -m json.tool

# Expected response:
# {
#   "site_id": "site-arguel",
#   "site_name": "Arguel",
#   "para_index": 45,
#   "verdict": "MOYEN",
#   "consensus": [...],
#   "metrics": {...},
#   "slots": [...]
# }
```

### Test 3: Get Flight Statistics
```bash
curl -s http://localhost:8001/api/flights/stats | python3 -m json.tool

# Expected response:
# {
#   "total_flights": 6,
#   "total_hours": 1.0,
#   "total_distance": 25.8,
#   "avg_duration": 10.3,
#   ...
# }
```

### Test 4: Get Flights List
```bash
curl -s http://localhost:8001/api/flights?limit=5 | python3 -m json.tool

# Expected response:
# {
#   "flights": [
#     {
#       "id": "flight-2025-11-08-1453",
#       "site_name": "La Côte",
#       "duration_minutes": 11,
#       ...
#     },
#     ...
#   ]
# }
```

## 🖥️ Frontend Browser Tests

Open `http://localhost:5173` and verify:

### Navigation
- [ ] Dashboard page loads
- [ ] No console errors (F12 → Console)
- [ ] Header displays with navigation links

### Dashboard Page
- [ ] Site selector appears with 3 sites (Arguel, Mont Poupet, La Côte)
- [ ] Clicking a site updates the dashboard
- [ ] Current conditions card displays:
  - [ ] Para-Index (0-10)
  - [ ] Verdict (BON/MOYEN/LIMITE/MAUVAIS)
  - [ ] Temperature
  - [ ] Wind speed and direction
  - [ ] Wind gusts
  - [ ] Conditions summary
  - [ ] Last update timestamp

### Hourly Forecast
- [ ] Table displays with 11h-18h hours
- [ ] Columns: Heure, Para-Index, Verdict, Temp, Vent, Direction
- [ ] All cells populated with data
- [ ] Rows color-coded by verdict (green/yellow/orange/red)

### 7-Day Forecast
- [ ] 7 cards displayed in responsive grid
- [ ] Each card shows:
  - [ ] Date (Today/Tomorrow/Weekday)
  - [ ] Para-Index
  - [ ] Min/Max temperature
  - [ ] Wind average
  - [ ] Conditions summary
  - [ ] Verdict emoji

### Statistics Panel
- [ ] 8 stats cards displayed
- [ ] All metrics populated:
  - [ ] Total flights
  - [ ] Total time
  - [ ] Total distance
  - [ ] Average duration
  - [ ] Average distance per flight
  - [ ] Average time per flight
  - [ ] Favorite spot
  - [ ] Last flight date

### Error Handling
- [ ] Try accessing non-existent site in URL → shows error
- [ ] Simulate network error → graceful error message
- [ ] Retry button works

### Responsive Design
Test at different viewport sizes:

#### Mobile (320px)
- [ ] Full-width cards stack vertically
- [ ] Site selector buttons wrap appropriately
- [ ] Hourly table scrolls horizontally
- [ ] Text remains readable
- [ ] All touch targets ≥ 44px

#### Tablet (768px)
- [ ] 2-column grid layouts
- [ ] Site selector in single row or wrapped
- [ ] Comfortable spacing
- [ ] No horizontal scroll (except table)

#### Desktop (1920px)
- [ ] 3-column layout on dashboard
- [ ] All content visible without scroll
- [ ] Proper spacing and alignment
- [ ] 7-day cards in full row

## 🧪 Component Tests

### SiteSelector
```bash
# Navigate to dashboard
# Expected: 3 sites as buttons
# Click each → data updates
# Keyboard: Tab through, Enter to select
```

### CurrentConditions
```bash
# Check data matches API response
# Para-index should be 0-10 scale (backend 0-100 divided by 10)
# Verdict colors: green (BON), yellow (MOYEN), orange (LIMITE), red (MAUVAIS)
```

### HourlyForecast
```bash
# Should show exactly 8 rows (11h-18h)
# No rows for hours outside 11h-18h
# Wind values from API consensus array
# Para-index calculated from wind data
```

### Forecast7Day
```bash
# Should show exactly 7 days
# Dates calculated correctly (today + 6 future days)
# Min/Max temps from daily consensus data
# Wind average from API metrics
```

### StatsPanel
```bash
# All 8 cards should be visible
# Numbers formatted correctly:
# - Duration: "Xh Ymin" format
# - Distance: "X.X km" format
# - Count: whole numbers
```

## 📊 Network Inspector

Open DevTools → Network tab and verify:

### GET /api/spots
- [ ] Status: 200 OK
- [ ] Size: ~1-2 KB
- [ ] Time: < 100ms
- [ ] Response type: application/json

### GET /api/weather/site-*
- [ ] Status: 200 OK
- [ ] Size: ~10-15 KB (full consensus data)
- [ ] Time: < 500ms
- [ ] Response type: application/json

### GET /api/flights/stats
- [ ] Status: 200 OK
- [ ] Size: < 1 KB
- [ ] Time: < 100ms
- [ ] Response type: application/json

### Request Headers
- [ ] Content-Type: application/json
- [ ] Accept: */*
- [ ] No authentication errors

## 🔧 Environment Configuration

### .env.local
```bash
cat /home/capic/.openclaw/workspace/paragliding/dashboard/frontend/.env.local

# Expected output:
# VITE_ENABLE_MSW=false
```

### API Proxy (vite.config.ts)
```bash
grep -A 5 "proxy:" /home/capic/.openclaw/workspace/paragliding/dashboard/frontend/vite.config.ts

# Expected:
# proxy: {
#   '/api': {
#     target: 'http://dashboard-backend:8000',
```

## 🐛 Debugging

### If API returns "Not found"
1. Check backend is running: `docker ps | grep dashboard-backend`
2. Test backend directly: `curl http://localhost:8001/api/spots`
3. Check Docker network: `docker network inspect dashboard-net`

### If frontend shows loading spinner indefinitely
1. Open DevTools → Network tab
2. Check if requests are being made
3. Look for failed requests (red)
4. Check console for error messages
5. Verify MSW is disabled: `VITE_ENABLE_MSW=false`

### If data doesn't update on site selection
1. Check if click handler fires (add console.log)
2. Verify useWeather hook is being called
3. Check TanStack Query devtools (if installed)
4. Verify siteId is being passed correctly

### If styling looks broken
1. Check if Tailwind CSS is loaded (check <head> in DevTools)
2. Verify tailwind.config.js is correct
3. Run `npm run build` and check dist/ folder

## 📱 Mobile Testing

If possible, test on actual devices:

### iPhone (Safari)
- [ ] Dashboard loads and is responsive
- [ ] Touch interactions work
- [ ] No layout shifts
- [ ] Text is readable without zoom

### Android (Chrome)
- [ ] Same checks as iPhone
- [ ] Verify orientation changes work

### Tablet
- [ ] Landscape and portrait modes
- [ ] Multi-column layouts work

## ✅ Final Verification

Run this script to verify all systems:

```bash
#!/bin/bash

echo "🔍 Frontend Verification"
echo "========================"
echo ""

# Check backend
echo "1. Backend API..."
if curl -s http://localhost:8001/api/spots > /dev/null; then
  echo "   ✅ Backend is running"
else
  echo "   ❌ Backend is not responding"
  exit 1
fi

# Check TypeScript
echo "2. TypeScript compilation..."
if npm run type-check > /dev/null 2>&1; then
  echo "   ✅ TypeScript is valid"
else
  echo "   ❌ TypeScript errors detected"
  exit 1
fi

# Check Docker
echo "3. Docker containers..."
if docker ps | grep dashboard-frontend > /dev/null; then
  echo "   ✅ Frontend container running"
else
  echo "   ⚠️  Frontend container not running (might be OK if testing locally)"
fi

if docker ps | grep dashboard-backend > /dev/null; then
  echo "   ✅ Backend container running"
else
  echo "   ❌ Backend container not running"
  exit 1
fi

# Check API endpoints
echo "4. API endpoints..."
SITES=$(curl -s http://localhost:8001/api/spots | grep -c '"id"')
if [ "$SITES" -ge 3 ]; then
  echo "   ✅ /api/spots returns $SITES sites"
else
  echo "   ❌ /api/spots not working properly"
  exit 1
fi

WEATHER=$(curl -s http://localhost:8001/api/weather/site-arguel | grep -c '"para_index"')
if [ "$WEATHER" -eq 1 ]; then
  echo "   ✅ /api/weather/{id} returns para_index"
else
  echo "   ❌ /api/weather/{id} not working properly"
  exit 1
fi

STATS=$(curl -s http://localhost:8001/api/flights/stats | grep -c '"total_flights"')
if [ "$STATS" -eq 1 ]; then
  echo "   ✅ /api/flights/stats returns metrics"
else
  echo "   ❌ /api/flights/stats not working properly"
  exit 1
fi

echo ""
echo "✅ All checks passed! Frontend is ready."
echo ""
echo "📌 Access the dashboard at: http://localhost:5173"
```

Save as `verify.sh` and run:
```bash
chmod +x verify.sh
./verify.sh
```

## 🎉 Success Criteria

If all checks pass, the frontend is working correctly:
- ✅ API responses are valid
- ✅ Frontend displays data correctly
- ✅ No console errors
- ✅ Responsive design works
- ✅ Error handling works
- ✅ All components render

**Status**: Ready for production deployment! 🚀
