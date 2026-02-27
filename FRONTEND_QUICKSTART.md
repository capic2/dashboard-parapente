# 🪂 Frontend Quickstart - Dashboard Parapente

## 🚀 Start Development Server

```bash
cd /home/capic/.openclaw/workspace/paragliding/dashboard/frontend
npm run dev
```

**Open:** http://localhost:5173/

---

## 📂 Project Structure

```
frontend/src/
├── hooks/           → TanStack Query data fetching
│   ├── useWeather.ts
│   ├── useFlights.ts
│   ├── useAlerts.ts
│   └── useSites.ts
│
├── components/      → Reusable UI components
│   ├── Header.tsx
│   ├── SiteSelector.tsx
│   ├── CurrentConditions.tsx
│   ├── Forecast7Day.tsx
│   ├── HourlyForecast.tsx
│   └── StatsPanel.tsx
│
├── pages/           → Route pages
│   ├── Dashboard.tsx        (main page)
│   ├── FlightHistory.tsx    (placeholder)
│   └── Settings.tsx         (placeholder)
│
├── App.jsx          → Router + QueryClient setup
└── main.jsx         → React entry point
```

---

## 🎯 Current Routes

- `/` → Dashboard (main weather + stats)
- `/flights` → Flight History (placeholder)
- `/settings` → Settings (placeholder)

---

## 🔌 API Integration (Backend Required)

All hooks expect these endpoints:

### Weather
```
GET /api/weather/{spot_id}
GET /api/weather/current
```

### Flights
```
GET /api/flights
GET /api/flights/stats
GET /api/flights/{id}
```

### Sites
```
GET /api/spots
GET /api/spots/{id}
GET /api/spots/nearby?lat=X&lng=Y&radius=Z
```

### Alerts
```
GET /api/alerts
GET /api/alerts?spot_id=X
GET /api/alerts?active=true
```

---

## 🛠️ Useful Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run type-check       # TypeScript type checking
npm run lint             # ESLint checks

# Testing
npm test                 # Run tests (Vitest)
npm run test:ui          # Test UI
npm run coverage         # Coverage report
```

---

## 🎨 Design System

### Colors (Para-Index Verdicts)
- 🟢 **Bon:** `#d1fae5` / `#065f46`
- 🟡 **Moyen:** `#fef3c7` / `#92400e`
- 🟠 **Limite:** `#fed7aa` / `#92400e`
- 🔴 **Mauvais:** `#fee2e2` / `#7f1d1d`

### Primary Theme
- **Background:** Purple gradient `#667eea` → `#764ba2`
- **Cards:** White with `box-shadow`
- **Text:** `#1f2937` (dark) / `#6b7280` (medium) / `#9ca3af` (light)

### Responsive Breakpoints
- **Mobile:** < 640px
- **Tablet:** 640px - 1024px
- **Desktop:** > 1024px

---

## 📦 Dependencies

### Core
- React 19 + Vite
- TypeScript 5.3
- TanStack Router 1.25
- TanStack Query 5.28

### UI
- Axios (HTTP client)
- date-fns (date formatting)
- Chart.js (future charts)

### 3D (Ready for Week 2)
- Cesium.js 1.113
- Resium 1.17

---

## 🐛 Troubleshooting

### Dev server won't start
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run dev
```

### TypeScript errors
```bash
npm run type-check
```

### Port 5173 already in use
```bash
# Find and kill process
lsof -ti:5173 | xargs kill -9
npm run dev
```

---

## ✅ Week 1 Status

**Completed:**
- ✅ All 4 hooks created
- ✅ All 6 components built
- ✅ Dashboard page functional
- ✅ Responsive design implemented
- ✅ TanStack Router + Query integrated
- ✅ Dev server running

**Pending (Week 2):**
- ⏳ Backend API implementation
- ⏳ Real data integration
- ⏳ 3D flight viewer (Cesium)
- ⏳ Weather alerts system
- ⏳ Flight history page
- ⏳ Settings page

---

## 📚 Key Files to Know

### `App.jsx`
Router + QueryClient configuration. Add new routes here.

### `Dashboard.tsx`
Main page layout. Shows all weather components for selected site.

### `useWeather.ts`
Weather data hook. Customize staleTime/refetchInterval here.

### `SiteSelector.tsx`
Site tab switcher. Updates selected site for all child components.

---

## 🎯 Next Development Steps

1. **Start Backend:**
   ```bash
   cd ../backend
   npm run dev  # (when created)
   ```

2. **Test API Integration:**
   - Create mock endpoints
   - Verify data flows to components
   - Check error states

3. **Add Features:**
   - Site modal with map
   - Alert notifications
   - 3D flight viewer

---

**Questions?** Check `WEEK1_COMPLETION.md` for full technical details.

**Dev Server:** http://localhost:5173/
