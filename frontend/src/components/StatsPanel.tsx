
import { useFlightStats } from '../hooks/useFlights';
import './StatsPanel.css';

export default function StatsPanel() {
  const { data: stats, isLoading, error } = useFlightStats();

  if (isLoading) {
    return (
      <div className="card stats-panel">
        <h2>📊 Statistiques</h2>
        <div className="loading-state">Chargement...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card stats-panel">
        <h2>📊 Statistiques</h2>
        <div className="error-state">Données non disponibles</div>
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
    <div className="card stats-panel">
      <h2>📊 Statistiques</h2>
      
      <div className="stats-grid-panel">
        {/* Row 1 */}
        <div className="stat-item">
          <div className="stat-icon">🪂</div>
          <div className="stat-content">
            <div className="stat-number">{stats.total_flights}</div>
            <div className="stat-label">Vols totaux</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <div className="stat-number">{formatDuration(stats.total_hours)}</div>
            <div className="stat-label">Temps total</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">📏</div>
          <div className="stat-content">
            <div className="stat-number">{stats.total_distance.toFixed(1)} km</div>
            <div className="stat-label">Distance totale</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">⌀</div>
          <div className="stat-content">
            <div className="stat-number">{formatDuration(stats.avg_duration)}</div>
            <div className="stat-label">Durée moyenne</div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="stat-item">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <div className="stat-number">{avgDistancePerFlight} km</div>
            <div className="stat-label">Dist. moyenne</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">🕐</div>
          <div className="stat-content">
            <div className="stat-number">{avgHoursPerFlight}h</div>
            <div className="stat-label">Temps moyen</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <div className="stat-number">{stats.favorite_spot || 'N/A'}</div>
            <div className="stat-label">Site favori</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <div className="stat-number">
              {stats.last_flight_date 
                ? new Date(stats.last_flight_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                : 'N/A'}
            </div>
            <div className="stat-label">Dernier vol</div>
          </div>
        </div>
      </div>
    </div>
  );
}
