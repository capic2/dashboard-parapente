
import { useWeather } from '../hooks/useWeather';
import './CurrentConditions.css';

interface CurrentConditionsProps {
  spotId: string;
}

const getVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon') return 'verdict-bon';
  if (v === 'moyen') return 'verdict-moyen';
  if (v === 'limite') return 'verdict-limite';
  return 'verdict-mauvais';
};

const getVerdictEmoji = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon') return '🟢';
  if (v === 'moyen') return '🟡';
  if (v === 'limite') return '🟠';
  return '🔴';
};

export default function CurrentConditions({ spotId }: CurrentConditionsProps) {
  const { data: weather, isLoading, error } = useWeather(spotId);

  if (isLoading) {
    return (
      <div className="card current-conditions">
        <h2>Conditions Actuelles</h2>
        <div className="loading-state">Chargement...</div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="card current-conditions">
        <h2>Conditions Actuelles</h2>
        <div className="error-state">Impossible de charger les données météo</div>
      </div>
    );
  }

  return (
    <div className="card current-conditions">
      <h2>Conditions Actuelles - {weather.spot_name}</h2>
      
      <div className="para-index">
        <div className="score">{weather.para_index}/10</div>
        <div className={`verdict ${getVerdictClass(weather.verdict)}`}>
          {getVerdictEmoji(weather.verdict)} {weather.verdict.toUpperCase()}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-row">
          <span className="stat-label">🌡️ Température</span>
          <span className="stat-value">{weather.temperature}°C</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">💨 Vent</span>
          <span className="stat-value">
            {weather.wind_speed} km/h {weather.wind_direction}
          </span>
        </div>
        {weather.wind_gusts && (
          <div className="stat-row">
            <span className="stat-label">🌪️ Rafales</span>
            <span className="stat-value">{weather.wind_gusts} km/h</span>
          </div>
        )}
        <div className="stat-row">
          <span className="stat-label">☁️ Conditions</span>
          <span className="stat-value">{weather.conditions}</span>
        </div>
      </div>

      <div className="forecast-time">
        Mis à jour: {new Date(weather.forecast_time).toLocaleString('fr-FR')}
      </div>
    </div>
  );
}
