import { useTranslation } from 'react-i18next';
import { useFlightStats } from '../hooks/useFlights';

export default function StatsPanel() {
  const { t, i18n } = useTranslation();
  const { data: stats, isLoading, error } = useFlightStats();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-semibold">
          📊 {t('stats.title')}
        </h2>
        <div className="py-5 text-center text-gray-500 dark:text-gray-400 text-sm">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-semibold">
          📊 {t('stats.title')}
        </h2>
        <div className="py-5 text-center text-red-500 text-sm">
          {t('common.dataUnavailable')}
        </div>
      </div>
    );
  }

  const formatDuration = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  };

  const avgDistancePerFlight =
    stats.total_flights > 0
      ? (stats.total_distance_km / stats.total_flights).toFixed(1)
      : '0.0';

  const avgHoursPerFlight =
    stats.total_flights > 0
      ? (stats.total_hours / stats.total_flights).toFixed(1)
      : '0.0';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md flex-1 flex flex-col">
      <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-semibold">
        📊 {t('stats.title')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3 flex-1">
        {/* Row 1 */}
        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-gray-200 dark:border-gray-600 transition-all hover:border-sky-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-100">
          <div className="text-2xl leading-none shrink-0">🪂</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
              {stats.total_flights}
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-300 font-medium mt-0.5">
              {t('stats.totalFlights')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-gray-200 dark:border-gray-600 transition-all hover:border-sky-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-100">
          <div className="text-2xl leading-none shrink-0">⏱️</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
              {formatDuration(stats.total_hours)}
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-300 font-medium mt-0.5">
              {t('stats.totalTime')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-gray-200 dark:border-gray-600 transition-all hover:border-sky-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-100">
          <div className="text-2xl leading-none shrink-0">📏</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
              {stats.total_distance_km.toFixed(1)} km
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-300 font-medium mt-0.5">
              {t('stats.totalDistance')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-gray-200 dark:border-gray-600 transition-all hover:border-sky-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-100">
          <div className="text-2xl leading-none shrink-0">⌀</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
              {formatDuration(stats.avg_duration_minutes / 60)}
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-300 font-medium mt-0.5">
              {t('stats.avgDuration')}
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-gray-200 dark:border-gray-600 transition-all hover:border-sky-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-100">
          <div className="text-2xl leading-none shrink-0">📍</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
              {avgDistancePerFlight} km
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-300 font-medium mt-0.5">
              {t('stats.avgDistance')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-gray-200 dark:border-gray-600 transition-all hover:border-sky-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-100">
          <div className="text-2xl leading-none shrink-0">🕐</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
              {avgHoursPerFlight}h
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-300 font-medium mt-0.5">
              {t('stats.avgTime')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-gray-200 dark:border-gray-600 transition-all hover:border-sky-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-100">
          <div className="text-2xl leading-none shrink-0">⭐</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
              {stats.favorite_spot || 'N/A'}
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-300 font-medium mt-0.5">
              {t('stats.favoriteSite')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-gray-200 dark:border-gray-600 transition-all hover:border-sky-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-100">
          <div className="text-2xl leading-none shrink-0">📅</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
              {stats.last_flight_date
                ? new Date(stats.last_flight_date).toLocaleDateString(i18n.language.startsWith('en') ? 'en-US' : 'fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                  })
                : 'N/A'}
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-300 font-medium mt-0.5">
              {t('stats.lastFlight')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
