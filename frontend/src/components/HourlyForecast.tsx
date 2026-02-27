import { useWeather } from '../hooks/useWeather';

interface HourlyForecastProps {
  spotId: string;
}

const getVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon') return 'bg-green-50 hover:bg-green-100';
  if (v === 'moyen') return 'bg-yellow-50 hover:bg-yellow-100';
  if (v === 'limite') return 'bg-orange-50 hover:bg-orange-100';
  return 'bg-red-50 hover:bg-red-100';
};

export default function HourlyForecast({ spotId }: HourlyForecastProps) {
  const { data: weather, isLoading, error } = useWeather(spotId);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 mb-3 font-semibold">Prévisions Horaires (11h-18h)</h2>
        <div className="py-5 text-center text-gray-500 text-sm">Chargement...</div>
      </div>
    );
  }

  if (error || !weather || !weather.hourly_forecast) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 mb-3 font-semibold">Prévisions Horaires (11h-18h)</h2>
        <div className="py-5 text-center text-red-500 text-sm">Données non disponibles</div>
      </div>
    );
  }

  // Filter hours between 11h and 18h
  const flyingHours = weather.hourly_forecast.filter(h => {
    const hour = parseInt(h.hour.split(':')[0]);
    return hour >= 11 && hour <= 18;
  });

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <h2 className="text-sm text-gray-600 mb-3 font-semibold">Prévisions Horaires (11h-18h)</h2>
      
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Heure</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Para-Index</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Verdict</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Temp</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Vent</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Direction</th>
            </tr>
          </thead>
          <tbody>
            {flyingHours.length > 0 ? (
              flyingHours.map((hour, index) => (
                <tr key={index} className={`border-b border-gray-100 transition-colors ${getVerdictClass(hour.verdict)}`}>
                  <td className="py-2.5 px-2 font-medium">{hour.hour}</td>
                  <td className="py-2.5 px-2">
                    <strong className="text-purple-600">{hour.para_index}/10</strong>
                  </td>
                  <td className="py-2.5 px-2 font-medium capitalize">{hour.verdict}</td>
                  <td className="py-2.5 px-2">{hour.temp}°C</td>
                  <td className="py-2.5 px-2">{hour.wind} km/h</td>
                  <td className="py-2.5 px-2">{hour.direction}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
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
