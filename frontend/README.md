# Dashboard Parapente Frontend

React 18 + TanStack Suite dashboard for paragliding weather forecasting and flight tracking.

## 🎯 Features

- **Real-time Weather Data**: Multi-source consensus forecasts from OpenMeteo, WeatherAPI, and other providers
- **Para-Index Scoring**: Dynamic 0-100 scoring system for flight conditions
- **Site Management**: List of paragliding spots with weather integration
- **Flight Tracking**: View and manage flight history from Strava integration
- **Statistics Dashboard**: Flight metrics, trends, and analytics
- **Responsive Design**: Mobile-first Tailwind CSS styling
- **Type-Safe**: Full TypeScript support with Zod validation

## 📋 Tech Stack

- **Frontend**: React 18 + TypeScript
- **Routing**: TanStack Router
- **State Management**: TanStack Query + Zustand
- **Tables**: TanStack Table
- **Styling**: Tailwind CSS 4
- **Validation**: Zod schemas
- **Testing**: Vitest + React Testing Library
- **3D Maps**: Cesium.js (optional)
- **Build**: Vite

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Backend API running at `http://localhost:8000` (or configured proxy)

### Installation

```bash
cd frontend
npm install --legacy-peer-deps
```

### Development

```bash
npm run dev
```

Access at `http://localhost:5173`

### Build

```bash
npm run build
```

### Environment Variables

Create `.env.local`:

```
VITE_ENABLE_MSW=false  # Disable MSW mocks (use real API)
VITE_API_URL=http://localhost:8000  # Backend API URL
```

## 📁 Project Structure

```
src/
├── pages/
│   ├── Dashboard.tsx          # Main weather dashboard
│   ├── FlightHistory.tsx       # Flight list and viewer
│   ├── Analytics.tsx           # Performance charts
│   └── Settings.tsx            # User settings
├── components/
│   ├── SiteSelector.tsx        # Spot selector dropdown
│   ├── CurrentConditions.tsx   # Current Para-Index card
│   ├── HourlyForecast.tsx      # 11h-18h hourly table
│   ├── Forecast7Day.tsx        # 7-day daily overview
│   ├── StatsPanel.tsx          # Flight statistics
│   ├── FlightViewer3D.tsx      # 3D flight map (Cesium)
│   └── stories/                # Storybook components
├── hooks/
│   ├── useWeather.ts           # Weather data fetching
│   ├── useSites.ts             # Paragliding spots
│   ├── useFlights.ts           # Flight CRUD operations
│   └── useFlightsTable.tsx      # Flight table state
├── types/
│   └── index.ts                # TypeScript interfaces
├── schemas.ts                  # Zod validation schemas
├── mocks/
│   ├── handlers.ts             # MSW request handlers
│   ├── data.ts                 # Mock data
│   └── browser.ts              # MSW setup
└── App.tsx                     # Router setup
```

## 🔧 API Integration

### Backend Endpoints

The frontend expects these endpoints from the backend:

```
GET  /api/spots                  # Get all paragliding spots
GET  /api/spots/{spotId}         # Get specific spot
GET  /api/weather/{spotId}       # Get weather (with para_index)
GET  /api/flights                # Get flight list
GET  /api/flights/{flightId}     # Get flight details
GET  /api/flights/stats          # Get aggregate statistics
POST /api/flights                # Create new flight
PATCH /api/flights/{flightId}    # Update flight
DELETE /api/flights/{flightId}   # Delete flight
```

### Proxy Configuration

In development, Vite proxies `/api/*` requests to the backend:

**vite.config.ts:**
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://dashboard-backend:8000',  // Docker network
      changeOrigin: true
    }
  }
}
```

**Local development** (outside Docker):
```typescript
target: 'http://localhost:8001'  // Backend exposed port
```

## 🎨 Component Guide

### SiteSelector
- **Props**: `selectedSiteId`, `onSelectSite`
- **Hook**: `useSites()`
- **Features**: Loading, error states, keyboard support

### CurrentConditions
- **Props**: `spotId`
- **Hook**: `useWeather(spotId)`
- **Display**: Para-Index (0-10), verdict, temp, wind, conditions

### HourlyForecast
- **Props**: `spotId`
- **Hook**: `useWeather(spotId)`
- **Hours**: 11h-18h (flying window)
- **Display**: Hourly table with wind, temp, para_index, verdict

### Forecast7Day
- **Props**: `spotId`
- **Hook**: `useWeather(spotId)`
- **Display**: Daily cards with min/max temp, wind average, conditions

### StatsPanel
- **Hook**: `useFlightStats()`
- **Metrics**:
  - Total flights, hours, distance
  - Average duration, distance per flight
  - Max altitude, favorite spot
  - Last flight date

## 🧪 Testing

### Run Tests

```bash
npm run test                    # Run all tests
npm run test:ui                # Interactive UI
npm run coverage               # Coverage report
```

### Storybook

```bash
npm run storybook              # Start Storybook on :6006
npm run build-storybook        # Build for deployment
```

## ⚠️ Error Handling

All components handle three states:

1. **Loading**: Skeleton placeholders
2. **Error**: User-friendly error messages with retry buttons
3. **Success**: Full data display

### Validation

Zod schemas validate all API responses:

```typescript
// In hooks
const validation = WeatherDataSchema.safeParse(response.data)
if (!validation.success) {
  throw new Error(`Invalid weather data: ${validation.error.message}`)
}
```

## 📱 Responsive Design

- **Mobile**: 320px (single column, full width)
- **Tablet**: 768px (2-3 column grids)
- **Desktop**: 1024px+ (full layout)

Breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

## 🎯 Keyboard Shortcuts

Currently implemented:
- Site selector: Tab between spots, Enter to select
- Future: Alt+R for reload, Alt+D for dark mode

## 🐛 Known Issues & TODOs

- [ ] Dark mode toggle (skeleton exists)
- [ ] Flight path viewer 3D (Cesium component exists)
- [ ] PWA offline support
- [ ] Export to GeoJSON / GPX
- [ ] Notifications for good flying days
- [ ] Multi-language support (French > English)

## 📊 Performance Optimization

- TanStack Query with 5-minute stale time
- Code splitting: separate chunks for TanStack libs
- Image optimization with Vite
- Lazy loading for routes

## 🔒 Security

- CORS configured for backend origin
- Zod validation on all API responses
- XSS protection via React's built-in escaping
- No sensitive data in localStorage (future: auth tokens)

## 🚢 Deployment

### Docker

```bash
docker-compose up dashboard-frontend
```

Builds and runs on `localhost:5173`

### Production Build

```bash
npm run build
npm run preview  # Test production build locally
```

Output: `dist/` directory

## 📚 Additional Resources

- [TanStack Router Docs](https://tanstack.com/router/latest)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Tailwind CSS Docs](https://tailwindcss.com)
- [Vite Docs](https://vite.dev)
- [Zod Docs](https://zod.dev)

## 🤝 Contributing

1. Run `npm run type-check` before commits
2. Run `npm run lint` for code style
3. Add tests for new features
4. Update Storybook stories
5. Update this README

## 📝 License

MIT
