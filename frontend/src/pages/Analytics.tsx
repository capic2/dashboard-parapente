import { lazy, Suspense } from 'react';

// Lazy load components for better performance
const StatsDashboard = lazy(() => import('../components/stats/StatsDashboard'));
const AltitudeChart = lazy(() => import('../components/stats/AltitudeChart'));
const ProgressChart = lazy(() => import('../components/stats/ProgressChart'));
const SiteStats = lazy(() => import('../components/stats/SiteStats'));
const MonthlyStats = lazy(() => import('../components/stats/MonthlyStats'));

// Loading fallback component
function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md animate-pulse">
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  );
}

export default function Analytics() {
  return (
    <div>
      <div className="mb-4 bg-white rounded-xl p-4 shadow-md">
        <h1 className="text-xl font-bold text-gray-900">📊 Analyses et Statistiques</h1>
        <p className="text-sm text-gray-600 mt-1">Vue d'ensemble de votre progression en parapente</p>
      </div>

      <div className="space-y-4">
        {/* Overview Stats Cards */}
        <section>
          <Suspense fallback={<ChartSkeleton />}>
            <StatsDashboard />
          </Suspense>
        </section>

        {/* Charts Grid */}
        <section className="grid grid-cols-1 gap-4">
          {/* Altitude Progression */}
          <div>
            <Suspense fallback={<ChartSkeleton />}>
              <AltitudeChart />
            </Suspense>
          </div>

          {/* Flight Duration Progress */}
          <div>
            <Suspense fallback={<ChartSkeleton />}>
              <ProgressChart />
            </Suspense>
          </div>

          {/* Monthly Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Suspense fallback={<ChartSkeleton />}>
              <MonthlyStats />
            </Suspense>

            <Suspense fallback={<ChartSkeleton />}>
              <SiteStats />
            </Suspense>
          </div>
        </section>
      </div>
    </div>
  );
}
