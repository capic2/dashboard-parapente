# Frontend - Dashboard Parapente

Vue 3 frontend for the paragliding weather dashboard.

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

## 🎨 Design

See prototype: `../docs/PHASE-1-DESIGN/dashboard-frontend-structure.html`

Opens in browser to preview the full dashboard layout and sections.

---

## 🔌 API Integration

```javascript
// Connect to backend API
const API_BASE = 'http://localhost:8000/api/v1'

// Example: Fetch current conditions
const response = await fetch(`${API_BASE}/weather/current`)
const conditions = await response.json()
```

---

## 🧪 Testing

```bash
npm run test           # Run tests
npm run test:ui        # UI dashboard
npm run coverage       # Coverage report
```

---

## 📚 Documentation

- **[Frontend Prototype](../docs/PHASE-1-DESIGN/dashboard-frontend-structure.html)** — Interactive mockup
- **[API Spec](../docs/PHASE-1-DESIGN/dashboard-api-spec.md)** — Endpoints & formats

---

**Phase:** 3 Frontend (Starting March 28)  
**Estimated effort:** 40-50 hours
