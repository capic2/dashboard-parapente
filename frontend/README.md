# Frontend - Dashboard Parapente

**React 18 + TypeScript frontend with TanStack Query, Tailwind CSS, and Storybook.**

---

## Tech Stack

- **React 18** - UI library with hooks
- **TypeScript** - Type safety
- **TanStack Query** - Data fetching & caching
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing
- **Recharts** - Data visualization
- **Zod** - Runtime validation
- **Vitest + Testing Library** - Testing
- **Storybook** - Component development
- **Vite** - Build tool

---

## Component Architecture

```
src/
├── components/          # Reusable UI components
│   ├── SiteSelector.tsx               # Site selection with prefetch
│   ├── MultiOrientationSelector.tsx   # Generic multi-takeoff selector
│   ├── CurrentConditions.tsx          # Current weather widget
│   ├── HourlyForecast.tsx            # Hour-by-hour predictions
│   ├── Forecast7Day.tsx              # Weekly overview
│   ├── BestSpotSuggestion.tsx        # AI recommendation
│   ├── WindIndicator.tsx             # Wind direction arrows
│   └── stats/                         # Statistics components
│
├── pages/               # Page components
│   ├── Dashboard.tsx    # Main weather dashboard
│   ├── FlightHistory.tsx # Flight log
│   ├── Analytics.tsx    # Statistics & charts
│   └── Settings.tsx     # User preferences
│
├── hooks/               # Custom React hooks
│   ├── useWeather.ts    # Weather data fetching
│   ├── useSites.ts      # Sites management
│   ├── useFlights.ts    # Flight CRUD operations
│   └── useBestSpot.ts   # Best spot recommendation
│
├── types/               # TypeScript type definitions
│   └── index.ts         # Shared types
│
├── schemas.ts           # Zod validation schemas
├── api/                 # API client functions
└── App.tsx              # Root component
```

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Visit http://localhost:5173
```

**Backend must be running** on http://localhost:8000

📚 **Full guide:** [DEVELOPMENT.md](../DEVELOPMENT.md)

---

## Key Features

### 1. Data Fetching Strategy

**TanStack Query** with automatic caching:

```typescript
// Fetch weather with 5min cache
const { data, isLoading } = useWeather(siteId, dayIndex);

// Prefetch on hover for instant navigation
queryClient.prefetchQuery({
  queryKey: ['weather', 'combined', siteId, 0],
  queryFn: createWeatherQueryFn(siteId, 0),
});
```

### 2. Type Safety

**Zod schemas** validate all API responses:

```typescript
const WeatherDataSchema = z.object({
  para_index: z.number(),
  verdict: z.string(),
  temperature: z.number(),
  // ...
});

// Runtime validation
const data = WeatherDataSchema.parse(response);
```

### 3. Generic Components

**MultiOrientationSelector** works for any multi-takeoff site:

```typescript
// Automatically groups sites by base name
// Shows dropdown for Mont Poupet (N/S/W/E)
// Shows button for single-takeoff sites
<SiteSelector sites={sites} />
```

### 4. Responsive Design

Mobile-first Tailwind CSS:

```tsx
// Adapts to screen size
<div className="p-3 sm:p-2.5 min-w-[120px] sm:min-w-[100px]">
  {/* Content */}
</div>
```

---

## Development

### Run Dev Server

```bash
npm run dev
```

### Run Storybook

```bash
npm run storybook
# Opens http://localhost:6006
```

**Browse components** in isolation with mock data.

### Run Tests

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Type check
npm run type-check
```

### Linting

```bash
# Check
npm run lint

# Fix
npm run lint:fix
```

---

## Environment Variables

Create `.env`:

```bash
VITE_API_URL=http://localhost:8000
```

**Production:**
```bash
VITE_API_URL=https://your-domain.com
```

---

## Building

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

Output in `dist/` directory.

---

## Component Development with Storybook

### Create Story

```typescript
// SiteSelector.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import SiteSelector from './SiteSelector';

const meta: Meta<typeof SiteSelector> = {
  title: 'Components/SiteSelector',
  component: SiteSelector,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    selectedSiteId: 'site-arguel',
    onSelectSite: (id) => console.log('Selected:', id),
  },
};
```

### Mock Data

Stories use **MSW (Mock Service Worker)** for API mocking:

```typescript
// .storybook/preview.tsx
import { http, HttpResponse } from 'msw';

const handlers = [
  http.get('/api/sites', () => {
    return HttpResponse.json({
      sites: [/* mock data */]
    });
  }),
];
```

---

## Testing

### Component Tests

```typescript
// SiteSelector.test.tsx
import { render, screen } from '@testing-library/react';
import SiteSelector from './SiteSelector';

test('renders site buttons', () => {
  render(<SiteSelector sites={mockSites} />);
  expect(screen.getByText('Arguel')).toBeInTheDocument();
});
```

### Hook Tests

```typescript
// useWeather.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useWeather } from './useWeather';

test('fetches weather data', async () => {
  const { result } = renderHook(() => useWeather('site-arguel', 0));
  
  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  });
});
```

---

## Performance

### Optimizations

1. **React Query caching** - Avoids redundant API calls
2. **Prefetching on hover** - Instant navigation
3. **Code splitting** - Lazy load pages
4. **Image optimization** - Next-gen formats
5. **Memoization** - React.memo, useMemo, useCallback

### Bundle Size

Target: < 500 KB gzipped

Check with:
```bash
npm run build
npx vite-bundle-visualizer
```

---

## Accessibility

- ✅ Semantic HTML
- ✅ ARIA labels
- ✅ Keyboard navigation
- ✅ Color contrast (WCAG AA)
- ✅ Focus indicators

Test with:
```bash
npm run test:a11y
```

---

## Browser Support

- ✅ Chrome/Edge (last 2 versions)
- ✅ Firefox (last 2 versions)
- ✅ Safari (last 2 versions)
- ✅ Mobile Safari (iOS 15+)
- ✅ Mobile Chrome (Android 10+)

---

## Deployment

### Static Hosting

Build output in `dist/` can be hosted on:
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- Any static file server

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
CMD ["npm", "run", "preview"]
```

---

## Troubleshooting

### "Module not found"

```bash
rm -rf node_modules package-lock.json
npm install
```

### "Type errors"

```bash
npm run type-check
```

### "Storybook won't start"

```bash
# Clear cache
rm -rf .storybook/cache
npm run storybook
```

---

## More Documentation

- [Main README](../README.md) - Project overview
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Setup guide
- [USER_GUIDE.md](../USER_GUIDE.md) - User manual
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines

---

**Questions?** Check the docs above or open an issue.

**Happy coding! 🚀**
