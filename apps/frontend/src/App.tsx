import React from 'react';
import {
  RootRoute,
  Route,
  Router,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import Header from './components/common/Header';
import { ErrorBoundary } from '@dashboard-parapente/design-system';
import Dashboard from './pages/Dashboard';
import FlightHistory from './pages/FlightHistory';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { ViewerExport } from './pages/ViewerExport';
import { Sites } from './pages/Sites';
import { sitesQueryOptions } from './hooks/sites/useSites';
import {
  flightsQueryOptions,
  flightStatsQueryOptions,
  flightRecordsQueryOptions,
} from './hooks/flights/useFlights';
import { bestSpotQueryOptions } from './hooks/weather/useBestSpotAPI';

// Create query client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes (overridden per hook)
      gcTime: 1000 * 60 * 60, // 1 hour - keep data in cache longer for better UX
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Root layout with Header
const RootLayout: React.FC = () => (
  <div className="min-h-screen p-3 md:p-4 overflow-x-hidden bg-gray-50 dark:bg-gray-900 transition-colors">
    <div className="max-w-7xl mx-auto">
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  </div>
);

// Define routes using TanStack Router
const rootRoute = new RootRoute({
  component: RootLayout,
});

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
  loader: () => {
    queryClient.ensureQueryData(sitesQueryOptions());
    queryClient.ensureQueryData(bestSpotQueryOptions(0));
  },
});

const flightHistoryRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/flights',
  component: FlightHistory,
  loader: () => {
    queryClient.ensureQueryData(flightsQueryOptions({ limit: 50 }));
    queryClient.ensureQueryData(sitesQueryOptions());
  },
});

const analyticsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/analytics',
  component: Analytics,
  loader: () => {
    queryClient.ensureQueryData(flightStatsQueryOptions());
    queryClient.ensureQueryData(flightRecordsQueryOptions());
    queryClient.ensureQueryData(flightsQueryOptions());
  },
});

const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
  loader: () => {
    queryClient.ensureQueryData(sitesQueryOptions());
  },
});

const exportViewerRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/export-viewer',
  component: ViewerExport,
});

const sitesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/sites',
  component: Sites,
  loader: () => {
    queryClient.ensureQueryData(sitesQueryOptions());
  },
});

// Create router
const routeTree = rootRoute.addChildren([
  dashboardRoute,
  flightHistoryRoute,
  analyticsRoute,
  settingsRoute,
  exportViewerRoute,
  sitesRoute,
]);

const router = new Router({ routeTree });

// Ensure TypeScript knows about the router type
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// App component with providers
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
