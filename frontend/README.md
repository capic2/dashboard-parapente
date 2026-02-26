# Frontend - Dashboard Parapente

React 18 frontend for the paragliding weather dashboard.

---

## 🚀 Setup (Phase 3, Week 2)

### 1. Install Dependencies

```bash
npm install
```

### 2. Development Server

```bash
npm run dev
# Open: http://localhost:5173
```

### 3. Build for Production

```bash
npm run build
# Output: dist/
```

---

## 📊 Dashboard Sections

1. **Today at a Glance** — Current conditions for all sites
2. **5-Day Forecast** — Timeline view of best flying days
3. **Your Flights** — Strava history with weather context
4. **Learning Stats** — Analytics & improvements
5. **Alert Manager** — Create/manage weather alerts
6. **Weather Sources** — Compare data accuracy

---

## 🎨 Technology Stack

- **React 18** with Hooks
- **Zustand** for state management (lightweight)
- **React Router v6** for navigation
- **Vite** for fast development
- **Tailwind CSS** for styling
- **React ChartJS 2** for visualizations
- **Axios** for API calls
- **TypeScript** for type safety
- **Vitest** for testing

---

## 📁 Project Structure

```
src/
├── components/           # Reusable React components
│   ├── CurrentConditions.jsx
│   ├── Forecast7Day.jsx
│   ├── RecentFlights.jsx
│   ├── LearningStats.jsx
│   ├── AlertManager.jsx
│   ├── SourceComparison.jsx
│   └── Navigation.jsx
│
├── pages/               # Page-level components
│   ├── Dashboard.jsx
│   ├── FlightHistory.jsx
│   ├── Settings.jsx
│   └── Admin.jsx
│
├── stores/              # Zustand stores
│   ├── weatherStore.js
│   ├── flightsStore.js
│   ├── alertsStore.js
│   └── uiStore.js
│
├── hooks/               # Custom React hooks
│   ├── useWeather.js
│   ├── useFlights.js
│   └── useAlerts.js
│
├── utils/
│   ├── api.js           # Axios instance & API calls
│   └── formatting.js    # Data formatting helpers
│
├── App.jsx              # Root component
├── main.jsx             # React entry point
└── App.css              # Global styles
```

---

## 🔌 API Integration

```javascript
// Connect to backend API
const API_BASE = 'http://localhost:8000/api/v1'

// Example hook for fetching conditions
import { useWeather } from './hooks/useWeather'

function MyComponent() {
  const { conditions, loading, error } = useWeather()
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return <div>{conditions.temp_c}°C</div>
}
```

---

## 🗂️ State Management (Zustand)

Simple, lightweight state management with Zustand:

```javascript
// stores/weatherStore.js
import create from 'zustand'

export const useWeatherStore = create((set) => ({
  conditions: {},
  loading: false,
  
  setConditions: (conditions) => set({ conditions }),
  setLoading: (loading) => set({ loading }),
}))

// Usage in component
function Dashboard() {
  const { conditions, setConditions } = useWeatherStore()
  
  useEffect(() => {
    fetchConditions().then(data => setConditions(data))
  }, [])
  
  return <div>{conditions.para_index}</div>
}
```

---

## 🧪 Testing

```bash
npm run test           # Run tests
npm run test:ui        # UI dashboard
npm run coverage       # Coverage report
```

---

## 📚 Resources

- **[React Docs](https://react.dev/)** — React fundamentals
- **[React Router](https://reactrouter.com/)** — Navigation
- **[Zustand](https://github.com/pmndrs/zustand)** — State management
- **[Vite](https://vitejs.dev/)** — Build tool
- **[Tailwind CSS](https://tailwindcss.com/)** — Styling

---

**Phase:** 3 Frontend (Starting March 28)  
**Technology:** React 18 + Zustand + Vite  
**Estimated effort:** 40-50 hours
