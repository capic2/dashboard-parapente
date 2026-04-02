import { useTranslation } from 'react-i18next';
import { useSuspenseQuery } from '@tanstack/react-query';
import { FilterBar } from '../components/analytics/FilterBar';
import { useFiltersStore } from '../stores/filtersStore';
import {
  useFlights,
  useFlightStats,
  useFlightRecords,
} from '../hooks/flights/useFlights';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import StatsDashboard from '../components/analytics/StatsDashboard';
import AltitudeChart from '../components/analytics/AltitudeChart';
import ProgressChart from '../components/analytics/ProgressChart';
import SiteStats from '../components/analytics/SiteStats';
import MonthlyStats from '../components/analytics/MonthlyStats';
import TimeOfDayChart from '../components/analytics/TimeOfDayChart';
import WeekdayChart from '../components/analytics/WeekdayChart';
import RecordsDashboard from '../components/analytics/RecordsDashboard';
import AchievementsBadges from '../components/analytics/AchievementsBadges';

// Loading fallback component
function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md animate-pulse">
      <div className="h-64 bg-gray-200 dark:bg-gray-600 rounded"></div>
    </div>
  );
}

export default function Analytics() {
  const { t } = useTranslation();
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const { filters } = useFiltersStore();
  const { data: flights = [], isLoading: flightsLoading } = useFlights({
    limit: 500,
    siteId: filters.siteId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  const { data: stats, isLoading: statsLoading } = useFlightStats();
  const { data: records, isLoading: recordsLoading } = useFlightRecords();

  const isLoading = flightsLoading || statsLoading || recordsLoading;

  return (
    <div>
      <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          📊 {t('analytics.title')}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {t('analytics.subtitle')}
        </p>
      </div>

      {/* Filtres dynamiques */}
      <FilterBar sites={sites} />

      {isLoading ? (
        <div className="space-y-4">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Overview Stats Cards */}
          {stats && (
            <section>
              <StatsDashboard stats={stats} />
            </section>
          )}

          {/* Personal Records */}
          {records && (
            <section>
              <RecordsDashboard records={records} />
            </section>
          )}

          {/* Achievements */}
          {stats && (
            <section>
              <AchievementsBadges stats={stats} />
            </section>
          )}

          {/* Charts Grid */}
          <section className="grid grid-cols-1 gap-4">
            {/* Altitude Progression */}
            <div>
              <AltitudeChart flights={flights} />
            </div>

            {/* Flight Duration Progress */}
            <div>
              <ProgressChart flights={flights} />
            </div>

            {/* Monthly Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MonthlyStats flights={flights} />
              <SiteStats flights={flights} />
            </div>

            {/* Temporal Analysis - Time of Day & Weekday */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TimeOfDayChart flights={flights} />
              <WeekdayChart flights={flights} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
