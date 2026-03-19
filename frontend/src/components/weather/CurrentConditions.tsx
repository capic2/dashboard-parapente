import { useWeather } from '../../hooks/useWeather';
import { useSite } from '../../hooks/useSites';
import { WindIndicator } from '../WindIndicator';

interface CurrentConditionsProps {
  spotId: string;
}

const getVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon') return 'bg-green-100 text-green-800';
  if (v === 'moyen') return 'bg-yellow-100 text-yellow-800';
  if (v === 'limite') return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-900';
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
  const { data: site } = useSite(spotId);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-sky-600">
        <h2 className="text-sm text-gray-600 mb-3.5 font-semibold">Conditions Actuelles</h2>
        <div className="py-5 text-center text-gray-500 text-sm">Chargement...</div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-sky-600">
        <h2 className="text-sm text-gray-600 mb-3.5 font-semibold">Conditions Actuelles</h2>
        <div className="py-5 text-center text-red-500 text-sm">Impossible de charger les données météo</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-sky-600 flex-1 flex flex-col">
      <h2 className="text-sm text-gray-600 mb-3.5 font-semibold">
        Conditions Actuelles - {weather.spot_name}
      </h2>
      
      <div className="flex items-center gap-3 mb-4">
        <div className="text-4xl sm:text-3xl font-bold text-sky-600 leading-none">
          {weather.para_index}/100
        </div>
        <div className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${getVerdictClass(weather.verdict)}`}>
          {getVerdictEmoji(weather.verdict)} {weather.verdict.toUpperCase()}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
          <span className="text-gray-600 font-medium">🌡️ Température</span>
          <span className="font-semibold text-gray-900 text-right">{weather.temperature}°C</span>
        </div>
        <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
          <span className="text-gray-600 font-medium">💨 Vent</span>
          <div className="flex flex-col items-end gap-1">
            <span className="font-semibold text-gray-900 text-right">
              {weather.wind_speed} km/h {weather.wind_direction}
            </span>
            {site?.orientation && (
              <WindIndicator
                windDirection={weather.wind_direction}
                siteOrientation={Array.isArray(site.orientation) ? site.orientation[0] : site.orientation}
                windSpeed={weather.wind_speed}
                showLabel={false}
                size="sm"
              />
            )}
          </div>
        </div>
        {weather.wind_gusts && (
          <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
            <span className="text-gray-600 font-medium">🌪️ Rafales</span>
            <span className="font-semibold text-gray-900 text-right">{weather.wind_gusts} km/h</span>
          </div>
        )}
        <div className="flex justify-between text-sm py-1.5">
          <span className="text-gray-600 font-medium">☁️ Conditions</span>
          <span className="font-semibold text-gray-900 text-right">{weather.conditions}</span>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
        Mis à jour: {new Date(weather.forecast_time).toLocaleString('fr-FR')}
      </div>
    </div>
  );
}
