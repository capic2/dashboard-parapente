import React from 'react'
import { RootRoute, Route, Router, RouterProvider, Outlet } from '@tanstack/react-router'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import FlightHistory from './pages/FlightHistory'
import Settings from './pages/Settings'
import './App.css'

// Create query client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

// Root layout with Header
const RootLayout = () => (
  <div className="app">
    <div className="container">
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  </div>
)

// Define routes using TanStack Router
const rootRoute = new RootRoute({
  component: RootLayout,
})

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const flightHistoryRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/flights',
  component: FlightHistory,
})

const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
})

// Create router
const routeTree = rootRoute.addChildren([
  dashboardRoute,
  flightHistoryRoute,
  settingsRoute,
])

const router = new Router({ routeTree })

// App component with providers
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
