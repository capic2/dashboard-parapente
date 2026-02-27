import { lazy, Suspense } from 'react';
import './Analytics.css';

// Lazy load components for better performance
const StatsDashboard = lazy(() => import('../components/stats/StatsDashboard'));
const AltitudeChart = lazy(() => import('../components/stats/AltitudeChart'));
const ProgressChart = lazy(() => import('../components/stats/ProgressChart'));
const SiteStats = lazy(() => import('../components/stats/SiteStats'));
const MonthlyStats = lazy(() => import('../components/stats/MonthlyStats'));

// Loading fallback component
function ChartSkeleton() {
  return (
    <div className="chart-skeleton-wrapper">
      <div className="skeleton-box"></div>
    </div>
  );
}

export default function Analytics() {
  return (
    <div className="analytics-page">
      <div className="page-header">
        <h1>📊 Analyses et Statistiques</h1>
        <p className="subtitle">Vue d'ensemble de votre progression en parapente</p>
      </div>

      <div className="analytics-content">
        {/* Overview Stats Cards */}
        <section className="stats-section">
          <Suspense fallback={<ChartSkeleton />}>
            <StatsDashboard />
          </Suspense>
        </section>

        {/* Charts Grid */}
        <section className="charts-grid">
          {/* Altitude Progression */}
          <div className="chart-item full-width">
            <Suspense fallback={<ChartSkeleton />}>
              <AltitudeChart />
            </Suspense>
          </div>

          {/* Flight Duration Progress */}
          <div className="chart-item full-width">
            <Suspense fallback={<ChartSkeleton />}>
              <ProgressChart />
            </Suspense>
          </div>

          {/* Monthly Statistics */}
          <div className="chart-item">
            <Suspense fallback={<ChartSkeleton />}>
              <MonthlyStats />
            </Suspense>
          </div>

          {/* Site Statistics */}
          <div className="chart-item">
            <Suspense fallback={<ChartSkeleton />}>
              <SiteStats />
            </Suspense>
          </div>
        </section>
      </div>
    </div>
  );
}
