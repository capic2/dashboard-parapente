# Frontend - Dashboard Parapente

React 18 frontend with TanStack suite for advanced UI patterns.

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
3. **Your Flights** — Strava history with weather context (TanStack Table)
4. **Learning Stats** — Analytics & improvements
5. **Alert Manager** — Create/manage weather alerts (TanStack Form)
6. **Weather Sources** — Compare data accuracy (TanStack Table)

---

## 🎨 Technology Stack

**Core:**
- **React 18** with Hooks
- **Vite** for fast development
- **Tailwind CSS** for styling

**TanStack Suite:**
- **@tanstack/react-router** — Modern routing with type safety
- **@tanstack/react-query** — Data fetching, caching, synchronization
- **@tanstack/react-table** — Headless table library (sorting, filtering, pagination)
- **@tanstack/react-form** — Type-safe form handling with validation

**Others:**
- **Zustand** for lightweight state management (UI state)
- **Axios** for API calls (wrapped in TanStack Query)
- **React ChartJS 2** for visualizations

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
├── hooks/               # Custom React hooks
│   ├── useWeather.js    (TanStack Query hooks)
│   ├── useFlights.js    (TanStack Query + Mutations)
│   ├── useAlerts.js     (TanStack Query + Mutations)
│   ├── useAlertForm.js  (TanStack Form)
│   └── useFlightsTable.js (TanStack Table)
│
├── stores/              # Zustand stores (UI state only)
│   └── weatherStore.js
│
├── utils/
│   └── api.js           # Axios instance
│
├── App.jsx              # Root component with TanStack Router
├── main.jsx             # React entry point
└── App.css              # Global styles
```

---

## 🔌 TanStack Query (Data Fetching)

Automatic caching, refetching, and state synchronization.

```javascript
import { useQuery, useMutation } from '@tanstack/react-query'
import { useFlights, useCreateFlight } from './hooks/useFlights'

function FlightsList() {
  // Automatic caching + background refetch
  const { data: flights, isLoading } = useFlights()
  
  // Mutation with automatic cache invalidation
  const { mutate: createFlight } = useCreateFlight()
  
  if (isLoading) return <div>Loading...</div>
  
  return (
    <div>
      {flights.map(flight => (
        <div key={flight.id}>{flight.title}</div>
      ))}
    </div>
  )
}
```

**Benefits:**
- ✅ Automatic caching (configurable staleTime)
- ✅ Background refetching
- ✅ Automatic garbage collection
- ✅ Mutation + automatic cache invalidation
- ✅ Pagination, infinite queries, optimistic updates

---

## 📋 TanStack Table (Data Display)

Headless table with sorting, filtering, pagination.

```javascript
import { useFlightsTable } from './hooks/useFlightsTable'

function FlightsTable() {
  const { table, isLoading } = useFlightsTable()
  
  return (
    <table>
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th key={header.id} onClick={header.column.getToggleSortingHandler()}>
                {header.isPlaceholder ? null : header.renderHeader()}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id}>
            {row.getVisibleCells().map(cell => (
              <td key={cell.id}>{cell.renderCell()}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

**Features:**
- ✅ Sorting (multi-column)
- ✅ Filtering
- ✅ Pagination
- ✅ Row selection
- ✅ Column visibility
- ✅ Fully headless (bring your own UI)

---

## 🔑 TanStack Form (Forms)

Type-safe form handling with validation.

```javascript
import { useAlertForm } from './hooks/useAlertForm'

function AlertForm({ initialAlert }) {
  const { form, isLoading } = useAlertForm(initialAlert)
  
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <div>
            <label>{field.state.meta.name}</label>
            <input
              value={field.state.value}
              onChange={(e) => field.setValue(e.target.value)}
            />
          </div>
        )}
      </form.Field>
      
      <button type="submit" disabled={isLoading}>
        Save Alert
      </button>
    </form>
  )
}
```

**Benefits:**
- ✅ Type-safe form state
- ✅ Built-in validation
- ✅ Array field support
- ✅ Async validation
- ✅ Array fields (dynamic forms)

---

## 🧭 TanStack Router (Navigation)

Type-safe routing with modern features.

```javascript
import { Router, RootRoute, Route } from '@tanstack/react-router'

// Routes are defined in App.jsx
const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

// Navigate from components
import { useNavigate } from '@tanstack/react-router'

function Navigation() {
  const navigate = useNavigate()
  
  return (
    <nav>
      <button onClick={() => navigate({ to: '/' })}>Dashboard</button>
      <button onClick={() => navigate({ to: '/flights' })}>Flights</button>
    </nav>
  )
}
```

**Benefits:**
- ✅ Type-safe routes & params
- ✅ Route-level code splitting
- ✅ Search params with validation
- ✅ Loader functions (data fetching)
- ✅ Error boundaries per route

---

## 🗂️ Zustand (UI State)

Lightweight state management for UI-only state.

```javascript
import { useWeatherStore } from './stores/weatherStore'

function Dashboard() {
  // UI state (separate from data fetching)
  const { currentSite, setCurrentSite } = useWeatherStore()
  
  return (
    <select value={currentSite} onChange={(e) => setCurrentSite(e.target.value)}>
      <option>Select a site...</option>
    </select>
  )
}
```

**When to use:**
- ✅ UI state (selected site, filters, modal visibility)
- ❌ NOT for data fetching (use TanStack Query instead)

---

## 🧪 Testing

```bash
npm run test           # Run tests
npm run test:ui        # UI dashboard
npm run coverage       # Coverage report
```

---

## 📚 Resources

- **[TanStack Router](https://tanstack.com/router/latest)** — Modern routing
- **[TanStack Query](https://tanstack.com/query/latest)** — Data fetching
- **[TanStack Table](https://tanstack.com/table/latest)** — Headless table
- **[TanStack Form](https://tanstack.com/form/latest)** — Type-safe forms
- **[React Docs](https://react.dev/)** — React fundamentals
- **[Vite](https://vitejs.dev/)** — Build tool
- **[Tailwind CSS](https://tailwindcss.com/)** — Styling

---

## 🎯 Philosophy

Use **TanStack tools** for complex UI patterns:
- Data fetching → TanStack Query
- Tables/lists → TanStack Table
- Routing → TanStack Router
- Forms → TanStack Form
- Simple UI state → Zustand

This keeps the codebase focused and leverages the best tools for each job.

---

**Phase:** 3 Frontend (Starting March 28)  
**Technology:** React 18 + TanStack Suite  
**Estimated effort:** 40-50 hours
