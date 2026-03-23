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
    <div className="bg-white rounded-xl p-4 shadow-md border-l-4 border-sky-600">
      <h2 className="text-sm text-gray-600 mb-3.5 font-semibold">
        Conditions Actuelles - {weather.spot_name}
      </h2>
      
      {/* Grid horizontal responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Colonne 1: Para-index + Verdict */}
        <div className="flex flex-col justify-center">
          <div className="text-4xl font-bold text-sky-600 leading-none mb-2">
            {weather.para_index}/100
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold text-center ${getVerdictClass(weather.verdict)}`}>
            {getVerdictEmoji(weather.verdict)} {weather.verdict.toUpperCase()}
          </div>
        </div>

        {/* Colonne 2: Température */}
        <div className="flex flex-col justify-center lg:border-l-2 lg:border-gray-100 lg:pl-4">
          <span className="text-xs text-gray-500 mb-1">🌡️ Température</span>
          <span className="text-2xl font-bold text-gray-900">{weather.temperature}°C</span>
        </div>

        {/* Colonne 3: Vent */}
        <div className="flex flex-col justify-center lg:border-l-2 lg:border-gray-100 lg:pl-4">
          <span className="text-xs text-gray-500 mb-1">💨 Vent</span>
          <span className="text-2xl font-bold text-gray-900">{weather.wind_speed} km/h</span>
          <span className="text-xs text-gray-600 mt-1">{weather.wind_direction}</span>
          {site?.orientation && (
            <div className="mt-1">
              <WindIndicator
                windDirection={weather.wind_direction}
                siteOrientation={Array.isArray(site.orientation) ? site.orientation[0] : site.orientation}
                windSpeed={weather.wind_speed}
                showLabel={false}
                size="sm"
              />
            </div>
          )}
        </div>

        {/* Colonne 4: Conditions + Rafales */}
        <div className="flex flex-col justify-center lg:border-l-2 lg:border-gray-100 lg:pl-4">
          <span className="text-xs text-gray-500 mb-1">☁️ Conditions</span>
          <span className="text-sm font-semibold text-gray-900">{weather.conditions}</span>
          {weather.wind_gusts && (
            <>
              <span className="text-xs text-gray-500 mt-2">🌪️ Rafales</span>
              <span className="text-sm font-semibold text-gray-900">{weather.wind_gusts} km/h</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
        Mis à jour: {new Date(weather.forecast_time).toLocaleString('fr-FR')}
      </div>
    </div>
  );
}
