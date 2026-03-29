# Testing Guide - Week 2 Implementation

Quick reference for testing the Dashboard Parapente application.

## 🚀 Quick Start (5 minutes)

### Option 1: Automated Setup

```bash
cd /home/capic/.openclaw/workspace/paragliding/dashboard
./QUICKSTART.sh
```

### Option 2: Manual Setup

**1. Database Setup**

```bash
cd backend
python3 init_db.py      # Create database with 3 sites
python3 seed_flights.py # Create 5 sample flights with GPX
```

**2. Start Backend**

```bash
# Terminal 1
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**3. Test API**

```bash
# Terminal 2
cd backend
python3 test_endpoints.py
```

**4. Start Frontend**

```bash
# Terminal 3
cd frontend
npm run dev
```

**5. Open Browser**

- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs

## 📋 Manual Test Checklist

### Backend API Tests

```bash
# 1. Health Check
curl http://localhost:8000/api/health

# 2. Get Sites
curl http://localhost:8000/api/spots

# 3. Get Weather (replace {spot_id} with actual ID)
curl "http://localhost:8000/api/weather/site-arguel?day_index=0"

# 4. Get Flights
curl http://localhost:8000/api/flights?limit=10

# 5. Get Flight Stats
curl http://localhost:8000/api/flights/stats

# 6. Get GPX Data (replace {flight_id})
curl http://localhost:8000/api/flights/{flight_id}/gpx-data

# 7. Get Alerts
curl http://localhost:8000/api/alerts
```

### Frontend UI Tests

**Dashboard Page** (http://localhost:5173)

- [ ] Site selector shows 3 sites
- [ ] Selecting a site loads weather data
- [ ] Para-Index score displays (0-100)
- [ ] Verdict shows color-coded (green/yellow/orange/red)
- [ ] Current conditions show temp, wind, etc.
- [ ] Stats panel shows total flights, hours, distance
- [ ] Hourly forecast displays
- [ ] 7-day forecast displays

**Flight History Page** (http://localhost:5173/flights)

- [ ] Flight list shows 5 sample flights
- [ ] Flights show title, date, duration, distance, altitude
- [ ] Clicking a flight selects it (highlight)
- [ ] 3D viewer appears on right side
- [ ] GPX track renders on Cesium map
- [ ] Start marker (green) and end marker (red) visible
- [ ] Stats panel shows max altitude, elevation gain, distance
- [ ] Elevation profile chart displays below map
- [ ] Replay controls appear
- [ ] Changing replay speed (10-120s) works
- [ ] Play button starts animation
- [ ] Stop button stops animation
- [ ] Download GPX button downloads file
- [ ] Mobile view: stacks vertically

**Settings Page** (http://localhost:5173/settings)

- [ ] Placeholder displays (not implemented yet)

## 🔍 What to Look For

### Good Signs ✅

- **Para-Index:** Should be 0-100 (not negative, not > 100)
- **Verdict:** Should be one of: BON, MOYEN, LIMITE, MAUVAIS
- **Weather Data:** Should have hourly consensus array
- **Flight Stats:** Total hours should be sum of all flight durations
- **GPX Track:** Should show a realistic flight path (not a straight line)
- **Elevation Chart:** Should show climb, cruise, and descent phases

### Warning Signs ⚠️

- **Empty Data:** If no flights show, run `seed_flights.py`
- **Weather Error:** If weather fails, check API keys in `backend/.env`
- **3D Not Loading:** Check browser console for Cesium errors
- **Missing Map:** Cesium requires WebGL support

### Error Scenarios to Test

1. **No GPX File:** Try accessing a flight without GPX
   - Should show error: "No GPX file available"
2. **Invalid Site ID:** Try `/api/weather/invalid-id`
   - Should return 404: "Spot not found"
3. **Offline Mode:** Disconnect internet
   - Should gracefully fail with error messages

## 🐛 Debugging Tips

### Backend Issues

**Check Database**

```bash
cd backend
sqlite3 db/dashboard.db
> .tables
> SELECT COUNT(*) FROM flights;
> SELECT COUNT(*) FROM sites;
> .quit
```

**Check Logs**

```bash
# Backend should show:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Started scheduler with PeriodicCallback
```

**Test Individual Endpoints**

```bash
# Use the interactive API docs
open http://localhost:8000/docs
```

### Frontend Issues

**Check Console**

- Open browser DevTools (F12)
- Look for errors in Console tab
- Check Network tab for failed API calls

**Common Fixes**

1. **Cesium not loading:** Clear cache and reload
2. **API calls failing:** Check CORS and backend is running
3. **Missing data:** Check React Query DevTools

**React Query DevTools**

```tsx
// Already included in dev mode
// Bottom-left corner of the page
// Shows all queries and their states
```

## 📊 Expected Data

### Sample Flight Data

```
Flight 1: "Vol d'initiation Arguel"
  - Duration: 45 min
  - Distance: 3.2 km
  - Max Alt: 950 m
  - GPX: ~270 points

Flight 2: "Cross-country Mont Poupet"
  - Duration: 120 min
  - Distance: 18.5 km
  - Max Alt: 1420 m
  - GPX: ~720 points
```

### Sample Weather Response

```json
{
  "site_name": "Arguel",
  "para_index": 75,
  "verdict": "BON",
  "consensus": [
    {
      "hour": "09:00",
      "temp_c": 12,
      "wind_kmh": 15,
      "wind_dir": "NW"
    }
  ]
}
```

### Sample Stats

```json
{
  "total_flights": 5,
  "total_hours": 6.2,
  "total_distance": 48.1,
  "avg_duration": 74.0,
  "favorite_spot": "Mont Poupet"
}
```

## 🎯 Success Criteria

### Week 2 Completion Requirements

- [x] All 7 backend endpoints return 200 OK
- [x] Weather data includes Para-Index and verdict
- [x] Flight list displays from database
- [x] GPX data parses and returns coordinates
- [x] Stats calculate correctly
- [x] 3D viewer renders flight tracks
- [x] Elevation chart displays
- [x] Replay animation works
- [x] Responsive design on mobile

### Performance Benchmarks

- Page load: < 2 seconds
- Weather API: < 5 seconds
- GPX parsing: < 1 second
- 3D render: < 3 seconds
- Replay: smooth 30+ FPS

## 🆘 Getting Help

### Check These First

1. **WEEK2_IMPLEMENTATION.md** - Full implementation details
2. **COMPLETION_REPORT.md** - What was built and why
3. **Backend logs** - Terminal 1 output
4. **Browser console** - DevTools console tab
5. **API docs** - http://localhost:8000/docs

### Common Issues

**"ModuleNotFoundError"**

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

**"Database not found"**

```bash
cd backend
python3 init_db.py
```

**"No flights found"**

```bash
cd backend
python3 seed_flights.py
```

**"npm: command not found"**

```bash
# Install Node.js first
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**"Cesium is not defined"**

```bash
cd frontend
npm install cesium resium
```

## 📈 Next Steps

After confirming everything works:

1. **Customize Sites**
   - Edit `backend/init_db.py`
   - Add your local paragliding sites

2. **Real Flight Data**
   - Connect Strava webhook
   - Upload your own GPX files

3. **Deploy**
   - Follow deployment checklist in COMPLETION_REPORT.md

4. **Enhancements**
   - See "Next Steps" in WEEK2_IMPLEMENTATION.md

---

**Happy Testing! 🪂**
