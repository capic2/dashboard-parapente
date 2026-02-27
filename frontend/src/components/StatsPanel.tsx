
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

  return (
    <div className="card stats-panel">
      <h2>📊 Statistiques</h2>
      
      <div className="stats-grid-panel">
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
            <div className="stat-label">Temps de vol</div>
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

        <div className="stat-item">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <div className="stat-number">{stats.favorite_spot}</div>
            <div className="stat-label">Site favori</div>
          </div>
        </div>

        {stats.last_flight_date && (
          <div className="stat-item">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <div className="stat-number">
                {new Date(stats.last_flight_date).toLocaleDateString('fr-FR')}
              </div>
              <div className="stat-label">Dernier vol</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
