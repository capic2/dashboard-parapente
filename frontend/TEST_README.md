# Frontend Testing Guide

## 📚 Overview

This project uses a comprehensive testing strategy with **Vitest** for unit/integration tests and **Storybook** for component documentation and visual testing.

## 🎯 Test Infrastructure

### Setup Files

- `vitest.config.ts` - Vitest configuration with Happy-DOM environment
- `src/test/setup.ts` - Global test setup (MSW, matchers, mocks)
- `src/test/utils/test-utils.tsx` - Custom render with providers (QueryClient)
- `src/test/mocks/` - MSW handlers and mock data

### Technologies

- **Vitest** v4.0.18 - Test runner
- **@testing-library/react** - Component testing utilities
- **@testing-library/jest-dom** - DOM matchers
- **MSW** (Mock Service Worker) - API mocking
- **Happy-DOM** - Fast DOM implementation
- **Storybook** v10.2.14 - Component documentation
- **@storybook/addon-vitest** - Storybook tests integration

## 🚀 Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run coverage

# Run Storybook
npm run storybook

# Build Storybook
npm run build-storybook
```

## 📊 Coverage Goals

Target coverage: **>80%** for all metrics

- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

## 📝 Writing Tests

### Component Stories (CSF Next)

All components should have corresponding `.stories.tsx` files using the CSF Next format:

```typescript
import preview from '../../.storybook/preview'
import { fn, userEvent, within, expect } from 'storybook/test'
import MyComponent from './MyComponent'

const meta = preview.meta({
  title: 'Components/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Component description here',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    // ... argTypes
  },
})

// Story with variant
export const Default = meta.story({
  args: {
    // ... args
  },
})

// Story with interaction test
Default.test('should do something', async ({ canvasElement, args }) => {
  const canvas = within(canvasElement)
  // ... test assertions
})
```

### Unit Tests

Use the custom `render` from `test-utils.tsx` for components that need providers:

```typescript
import { render, screen } from '../test/utils/test-utils'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### API Mocking with MSW

Mock API calls in stories using MSW handlers:

```typescript
export const WithData = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('/api/data', () => {
          return HttpResponse.json({ data: 'mock' })
        }),
      ],
    },
  },
})
```

## 📁 Test File Structure

```
frontend/
├── vitest.config.ts
├── src/
│   ├── test/
│   │   ├── setup.ts
│   │   ├── utils/
│   │   │   └── test-utils.tsx
│   │   └── mocks/
│   │       ├── server.ts
│   │       ├── handlers.ts
│   │       └── data/
│   │           ├── sites.ts
│   │           ├── flights.ts
│   │           ├── weather.ts
│   │           └── weatherSources.ts
│   └── components/
│       ├── ComponentName.tsx
│       └── ComponentName.stories.tsx
```

## ✅ Testing Checklist for New Components

- [ ] Create `.stories.tsx` file
- [ ] Add 1 story per variant/state
- [ ] Add interaction tests for key user actions
- [ ] Mock API calls if component fetches data
- [ ] Test loading/error/empty states
- [ ] Verify accessibility (ARIA labels, keyboard nav)
- [ ] Check responsive behavior if applicable

## 🎨 Component Categories Tested

### ✅ Completed

**Group A: UI Primitives (3/3)**
- Modal (11 stories, 3 tests)
- Toast + ToastContainer (12 stories, 3 tests)
- DatePicker (11 stories, 3 tests)

**Group B: Display Components (4/4)**
- LoadingSkeleton (14 stories, 3 tests)
- ErrorBoundary (7 stories, 1 test)
- SiteCard (9 stories, 1 test)
- StatsPanel (5 stories)

**Total: 7 components, 69 stories, 14 tests**

### 🔄 Pattern Established

The following components should follow the same pattern:

**Group C: Weather (4 components)**
- CurrentConditions
- HourlyForecast
- Forecast7Day
- BestSpotSuggestion

**Group D: Forms (4 components)**
- MultiOrientationSelector
- CreateSiteModal
- EditSiteModal
- CreateFlightModal
- StravaSyncModal

**Group E: Stats/Charts (9 components)**
- RecordsDashboard
- AchievementsBadges
- AltitudeChart
- ProgressChart
- WeekdayChart
- TimeOfDayChart
- MonthlyStats
- SiteStats
- StatsDashboard

**Group F: Complex (3 components)**
- EmagramWidget
- FlightViewer3D
- ExportVideoModal

## 🚦 CI/CD

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`
- Only when `frontend/**` files change

### CI Jobs

1. **test** - Runs Vitest tests and generates coverage
2. **storybook** - Builds Storybook static site
3. **type-check** - Validates TypeScript types

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Storybook Documentation](https://storybook.js.org/)
- [MSW Documentation](https://mswjs.io/)
- [React Aria Components](https://react-spectrum.adobe.com/react-aria/react-aria-components.html)

## 🐛 Troubleshooting

### Tests failing with "Cannot find module"
- Ensure `vitest.config.ts` is properly configured
- Check import paths (use relative imports, not aliases)

### MSW handlers not working
- Verify handlers are registered in `src/test/mocks/handlers.ts`
- Check that the MSW server is started in `setup.ts`

### Storybook not loading
- Clear cache: `rm -rf node_modules/.cache`
- Rebuild: `npm run build-storybook`

### Type errors in tests
- Run `npm run type-check` to see all errors
- Ensure test files import from correct paths

## 📞 Support

For questions or issues, check:
1. This documentation
2. Existing component stories for examples
3. Project maintainers
