import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlightStats } from '../../hooks/flights/useFlights';

export default function StatsDashboard() {
  const { t } = useTranslation();
  const { data: stats, isLoading, error } = useFlightStats();

  const formattedStats = useMemo(() => {
    if (!stats) return null;

    return {
      totalFlights: stats.total_flights || 0,
      totalHours: Math.floor((stats.total_duration_minutes || 0) / 60),
      totalMinutes: (stats.total_duration_minutes || 0) % 60,
      totalDistance: (stats.total_distance_km || 0).toFixed(1),
      totalElevation: stats.total_elevation_gain_m || 0,
      avgDuration: Math.floor(stats.avg_duration_minutes || 0),
      avgDistance: (stats.avg_distance_km || 0).toFixed(1),
      maxAltitude: stats.max_altitude_m || 0,
      favoriteSite: stats.favorite_site?.name || stats.favorite_spot || 'N/A',
    };
  }, [stats]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-4 shadow-md animate-pulse"
          >
            <div className="w-12 h-12 bg-gray-200 rounded-full mb-3"></div>
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !formattedStats) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-md text-center text-red-600">
        <p>❌ {t('stats.statsLoadError')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Flights */}
      <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all border-2 border-sky-600">
        <div className="text-3xl mb-2">🪂</div>
        <div className="text-2xl font-bold text-gray-900">
          {formattedStats.totalFlights}
        </div>
        <div className="text-sm text-gray-600">{t('stats.flights')}</div>
      </div>

      {/* Total Hours */}
      <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all border-2 border-sky-600">
        <div className="text-3xl mb-2">⏱️</div>
        <div className="text-2xl font-bold text-gray-900">
          {formattedStats.totalHours}h{formattedStats.totalMinutes}m
        </div>
        <div className="text-sm text-gray-600">{t('stats.totalTime')}</div>
      </div>

      {/* Total Distance */}
      <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all border-2 border-sky-600">
        <div className="text-3xl mb-2">📏</div>
        <div className="text-2xl font-bold text-gray-900">
          {formattedStats.totalDistance} km
        </div>
        <div className="text-sm text-gray-600">{t('stats.totalDistance')}</div>
      </div>

      {/* Elevation Gain */}
      <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all border-2 border-sky-600">
        <div className="text-3xl mb-2">📈</div>
        <div className="text-2xl font-bold text-gray-900">
          {formattedStats.totalElevation} m
        </div>
        <div className="text-sm text-gray-600">{t('stats.totalElevation')}</div>
      </div>

      {/* Average Duration */}
      <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all border-2 border-gray-300">
        <div className="text-3xl mb-2">⌛</div>
        <div className="text-2xl font-bold text-gray-900">
          {formattedStats.avgDuration} min
        </div>
        <div className="text-sm text-gray-600">{t('stats.avgDuration')}</div>
      </div>

      {/* Average Distance */}
      <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all border-2 border-gray-300">
        <div className="text-3xl mb-2">🎯</div>
        <div className="text-2xl font-bold text-gray-900">
          {formattedStats.avgDistance} km
        </div>
        <div className="text-sm text-gray-600">{t('stats.avgDistance')}</div>
      </div>

      {/* Max Altitude */}
      <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-xl p-4 shadow-md hover:shadow-lg transition-all text-white">
        <div className="text-3xl mb-2">⛰️</div>
        <div className="text-2xl font-bold">{formattedStats.maxAltitude} m</div>
        <div className="text-sm opacity-90">{t('records.highestAltitude')}</div>
      </div>

      {/* Favorite Site */}
      <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-xl p-4 shadow-md hover:shadow-lg transition-all text-white">
        <div className="text-3xl mb-2">📍</div>
        <div className="text-lg font-bold truncate">
          {formattedStats.favoriteSite}
        </div>
        <div className="text-sm opacity-90">{t('stats.favoriteSite')}</div>
      </div>
    </div>
  );
}
