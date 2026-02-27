
import { useWeather } from '../hooks/useWeather';
import './HourlyForecast.css';

interface HourlyForecastProps {
  spotId: string;
}

const getVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon') return 'hour-good';
  if (v === 'moyen') return 'hour-ok';
  if (v === 'limite') return 'hour-ok';
  return 'hour-bad';
};

export default function HourlyForecast({ spotId }: HourlyForecastProps) {
  const { data: weather, isLoading, error } = useWeather(spotId);

  if (isLoading) {
    return (
      <div className="card hourly-forecast">
        <h2>Prévisions Horaires (11h-18h)</h2>
        <div className="loading-state">Chargement...</div>
      </div>
    );
  }

  if (error || !weather || !weather.hourly_forecast) {
    return (
      <div className="card hourly-forecast">
        <h2>Prévisions Horaires (11h-18h)</h2>
        <div className="error-state">Données non disponibles</div>
      </div>
    );
  }

  // Filter hours between 11h and 18h
  const flyingHours = weather.hourly_forecast.filter(h => {
    const hour = parseInt(h.hour.split(':')[0]);
    return hour >= 11 && hour <= 18;
  });

  return (
    <div className="card hourly-forecast">
      <h2>Prévisions Horaires (11h-18h)</h2>
      
      <div className="hourly-table-container">
        <table className="hourly-table">
          <thead>
            <tr>
              <th>Heure</th>
              <th>Para-Index</th>
              <th>Verdict</th>
              <th>Temp</th>
              <th>Vent</th>
              <th>Direction</th>
            </tr>
          </thead>
          <tbody>
            {flyingHours.length > 0 ? (
              flyingHours.map((hour, index) => (
                <tr key={index} className={getVerdictClass(hour.verdict)}>
                  <td className="hour-cell">{hour.hour}</td>
                  <td className="para-index-cell">
                    <strong>{hour.para_index}/10</strong>
                  </td>
                  <td className="verdict-cell">{hour.verdict}</td>
                  <td>{hour.temp}°C</td>
                  <td>{hour.wind} km/h</td>
                  <td>{hour.direction}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="no-data">
                  Aucune donnée horaire disponible
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
