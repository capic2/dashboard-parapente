
import { useWeather } from '../hooks/useWeather';
import './Forecast7Day.css';

interface Forecast7DayProps {
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

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Aujourd\'hui';
  if (date.toDateString() === tomorrow.toDateString()) return 'Demain';
  
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function Forecast7Day({ spotId }: Forecast7DayProps) {
  const { data: weather, isLoading, error } = useWeather(spotId);

  if (isLoading) {
    return (
      <div className="card forecast-7day">
        <h2>Prévisions 7 Jours</h2>
        <div className="loading-state">Chargement...</div>
      </div>
    );
  }

  if (error || !weather || !weather.daily_forecast) {
    return (
      <div className="card forecast-7day">
        <h2>Prévisions 7 Jours</h2>
        <div className="error-state">Données non disponibles</div>
      </div>
    );
  }

  return (
    <div className="card forecast-7day">
      <h2>Prévisions 7 Jours</h2>
      
      <div className="forecast-grid">
        {weather.daily_forecast.map((day, index) => (
          <div key={index} className="forecast-day">
            <div className="day-name">{formatDate(day.date)}</div>
            <div className="day-para-index">
              <span className="para-score">{day.para_index}</span>
              <span className={`para-verdict ${getVerdictClass(day.verdict)}`}>
                {getVerdictEmoji(day.verdict)}
              </span>
            </div>
            <div className="day-temp">
              {day.temp_min}° - {day.temp_max}°
            </div>
            <div className="day-wind">
              💨 {day.wind_avg} km/h
            </div>
            <div className="day-conditions">{day.conditions}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
