import { useMemo } from 'react';
import { useFlightStats } from '../../hooks/useFlights';
import './StatsDashboard.css';

export default function StatsDashboard() {
  const { data: stats, isLoading, error } = useFlightStats();

  const formattedStats = useMemo(() => {
    if (!stats) return null;

    return {
      totalFlights: stats.total_flights || 0,
      totalHours: Math.floor((stats.total_duration_minutes || 0) / 60),
      totalMinutes: (stats.total_duration_minutes || 0) % 60,
      totalDistance: (stats.total_distance_km || 0).toFixed(1),
      totalElevation: stats.total_elevation_gain_m || 0,
      avgDuration: Math.floor((stats.avg_duration_minutes || 0)),
      avgDistance: (stats.avg_distance_km || 0).toFixed(1),
      maxAltitude: stats.max_altitude_m || 0,
      favoriteSite: stats.favorite_site?.name || stats.favorite_spot || 'N/A',
    };
  }, [stats]);

  if (isLoading) {
    return (
      <div className="stats-dashboard">
        <div className="stats-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="stat-card skeleton">
              <div className="skeleton-icon"></div>
              <div className="skeleton-text"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !formattedStats) {
    return (
      <div className="stats-dashboard error">
        <p>❌ Impossible de charger les statistiques</p>
      </div>
    );
  }

  return (
    <div className="stats-dashboard">
      <div className="stats-grid">
        {/* Total Flights */}
        <div className="stat-card">
          <div className="stat-icon">🪂</div>
          <div className="stat-content">
            <div className="stat-value">{formattedStats.totalFlights}</div>
            <div className="stat-label">Vols</div>
          </div>
        </div>

        {/* Total Hours */}
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <div className="stat-value">
              {formattedStats.totalHours}h{formattedStats.totalMinutes}m
            </div>
            <div className="stat-label">Temps total</div>
          </div>
        </div>

        {/* Total Distance */}
        <div className="stat-card">
          <div className="stat-icon">📏</div>
          <div className="stat-content">
            <div className="stat-value">{formattedStats.totalDistance} km</div>
            <div className="stat-label">Distance totale</div>
          </div>
        </div>

        {/* Elevation Gain */}
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-value">{formattedStats.totalElevation} m</div>
            <div className="stat-label">Dénivelé total</div>
          </div>
        </div>

        {/* Average Duration */}
        <div className="stat-card secondary">
          <div className="stat-icon">⌛</div>
          <div className="stat-content">
            <div className="stat-value">{formattedStats.avgDuration} min</div>
            <div className="stat-label">Durée moyenne</div>
          </div>
        </div>

        {/* Average Distance */}
        <div className="stat-card secondary">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-value">{formattedStats.avgDistance} km</div>
            <div className="stat-label">Distance moyenne</div>
          </div>
        </div>

        {/* Max Altitude */}
        <div className="stat-card highlight">
          <div className="stat-icon">⛰️</div>
          <div className="stat-content">
            <div className="stat-value">{formattedStats.maxAltitude} m</div>
            <div className="stat-label">Altitude max</div>
          </div>
        </div>

        {/* Favorite Site */}
        <div className="stat-card highlight">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <div className="stat-value text">{formattedStats.favoriteSite}</div>
            <div className="stat-label">Site favori</div>
          </div>
        </div>
      </div>
    </div>
  );
}
