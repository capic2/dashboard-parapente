import { useFlightStats } from '../hooks/useFlights';

export default function StatsPanel() {
  const { data: stats, isLoading, error } = useFlightStats();

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 mb-3 font-semibold">📊 Statistiques</h2>
        <div className="py-5 text-center text-gray-500 text-sm">Chargement...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 mb-3 font-semibold">📊 Statistiques</h2>
        <div className="py-5 text-center text-red-500 text-sm">Données non disponibles</div>
      </div>
    );
  }

  const formatDuration = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  };

  const avgDistancePerFlight = stats.total_flights > 0 
    ? (stats.total_distance / stats.total_flights).toFixed(1)
    : '0.0';

  const avgHoursPerFlight = stats.total_flights > 0
    ? (stats.total_hours / stats.total_flights).toFixed(1)
    : '0.0';

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <h2 className="text-sm text-gray-600 mb-3 font-semibold">📊 Statistiques</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3">
        {/* Row 1 */}
        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-md border-2 border-gray-200 transition-all hover:border-purple-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-100">
          <div className="text-2xl leading-none shrink-0">🪂</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 leading-tight truncate">{stats.total_flights}</div>
            <div className="text-[10px] text-gray-600 font-medium mt-0.5">Vols totaux</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-md border-2 border-gray-200 transition-all hover:border-purple-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-100">
          <div className="text-2xl leading-none shrink-0">⏱️</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 leading-tight truncate">{formatDuration(stats.total_hours)}</div>
            <div className="text-[10px] text-gray-600 font-medium mt-0.5">Temps total</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-md border-2 border-gray-200 transition-all hover:border-purple-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-100">
          <div className="text-2xl leading-none shrink-0">📏</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 leading-tight truncate">{stats.total_distance.toFixed(1)} km</div>
            <div className="text-[10px] text-gray-600 font-medium mt-0.5">Distance totale</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-md border-2 border-gray-200 transition-all hover:border-purple-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-100">
          <div className="text-2xl leading-none shrink-0">⌀</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 leading-tight truncate">{formatDuration(stats.avg_duration)}</div>
            <div className="text-[10px] text-gray-600 font-medium mt-0.5">Durée moyenne</div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-md border-2 border-gray-200 transition-all hover:border-purple-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-100">
          <div className="text-2xl leading-none shrink-0">📍</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 leading-tight truncate">{avgDistancePerFlight} km</div>
            <div className="text-[10px] text-gray-600 font-medium mt-0.5">Dist. moyenne</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-md border-2 border-gray-200 transition-all hover:border-purple-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-100">
          <div className="text-2xl leading-none shrink-0">🕐</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 leading-tight truncate">{avgHoursPerFlight}h</div>
            <div className="text-[10px] text-gray-600 font-medium mt-0.5">Temps moyen</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-md border-2 border-gray-200 transition-all hover:border-purple-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-100">
          <div className="text-2xl leading-none shrink-0">⭐</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 leading-tight truncate">{stats.favorite_spot || 'N/A'}</div>
            <div className="text-[10px] text-gray-600 font-medium mt-0.5">Site favori</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-md border-2 border-gray-200 transition-all hover:border-purple-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-100">
          <div className="text-2xl leading-none shrink-0">📅</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900 leading-tight truncate">
              {stats.last_flight_date 
                ? new Date(stats.last_flight_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                : 'N/A'}
            </div>
            <div className="text-[10px] text-gray-600 font-medium mt-0.5">Dernier vol</div>
          </div>
        </div>
      </div>
    </div>
  );
}
