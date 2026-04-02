import { useTranslation } from 'react-i18next';
import {
  useLandingAssociations,
  useLandingWeather,
} from '../../hooks/sites/useLandingAssociations';

interface WeatherMultiLandingProps {
  spotId: string;
  dayIndex: number;
}

const getVerdictColor = (verdict: string): string => {
  const v = verdict?.toLowerCase();
  if (v === 'bon') return 'border-green-500 bg-green-50 dark:bg-green-900/20';
  if (v === 'moyen')
    return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
  if (v === 'limite')
    return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
  return 'border-red-500 bg-red-50 dark:bg-red-900/20';
};

const getVerdictEmoji = (verdict: string): string => {
  const v = verdict?.toLowerCase();
  if (v === 'bon') return '🟢';
  if (v === 'moyen') return '🟡';
  if (v === 'limite') return '🟠';
  return '🔴';
};

export default function WeatherMultiLanding({
  spotId,
  dayIndex,
}: WeatherMultiLandingProps) {
  const { t } = useTranslation();
  const { data: associations } = useLandingAssociations(spotId);
  const { data: weatherData, isLoading } = useLandingWeather(spotId, dayIndex);

  // Don't render anything if no associations
  if (!associations || associations.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-indigo-500">
      <h2 className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-semibold">
        {t('weather.landings')}
      </h2>

      {isLoading ? (
        <div className="py-3 text-center text-gray-500 dark:text-gray-400 text-sm">
          {t('weather.loadingLandings')}
        </div>
      ) : !weatherData || weatherData.length === 0 ? (
        <div className="py-3 text-center text-gray-400 dark:text-gray-500 text-sm">
          {t('weather.noWeatherData')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {weatherData.map((entry) => {
            const weather = entry.weather;
            const hasError = !!weather.error;
            const verdict = weather.verdict || '';

            return (
              <div
                key={entry.landing_site_id}
                className={`rounded-lg border-l-4 p-3 ${
                  hasError
                    ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                    : getVerdictColor(verdict)
                } ${entry.is_primary ? 'ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-gray-800' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {entry.landing_site_name}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                    {entry.distance_km != null ? `${entry.distance_km} km` : ''}
                  </span>
                </div>

                {hasError ? (
                  <p className="text-xs text-red-500">{weather.error}</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-lg" title={verdict}>
                      {getVerdictEmoji(verdict)}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {verdict}
                      </div>
                      {weather.para_index != null && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Para Index: {weather.para_index}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {entry.is_primary && (
                  <span className="inline-block mt-2 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                    {t('weather.primary')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
