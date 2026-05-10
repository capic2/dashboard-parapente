import { useTranslation } from 'react-i18next';
import {
  useLandingAssociations,
  useLandingWeather,
} from '../../hooks/sites/useLandingAssociations';
import { getVerdictVisual, weatherCardClassName } from './weatherUi';

interface WeatherMultiLandingProps {
  spotId: string;
  dayIndex: number;
}

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
    <div
      className={`${weatherCardClassName} border-l-4 border-l-indigo-500 p-4`}
    >
      <div className="mb-3">
        <h2 className="text-sm text-gray-600 dark:text-gray-400 font-semibold">
          {t('weather.landings')}
        </h2>
      </div>

      {isLoading ? (
        <div
          className="py-3 text-center text-gray-500 dark:text-gray-400 text-sm"
          aria-live="polite"
        >
          {t('weather.loadingLandings')}
        </div>
      ) : !weatherData || weatherData.length === 0 ? (
        <div className="py-3 text-center text-gray-400 dark:text-gray-400 text-sm">
          {t('weather.noWeatherData')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {weatherData.map((entry) => {
            const weather = entry.weather;
            const hasError = !!weather.error;
            const verdict = weather.verdict || '';
            const verdictVisual = getVerdictVisual(verdict);
            const VerdictIcon = verdictVisual.Icon;

            return (
              <div
                key={entry.landing_site_id}
                className={`rounded-lg border-l-4 p-3 ${
                  hasError
                    ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                    : verdictVisual.borderSoftClassName
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
                  <p
                    className="text-xs text-red-500 dark:text-red-400"
                    role="alert"
                  >
                    {weather.error}
                  </p>
                ) : (
                  <div className="flex items-center gap-3">
                    <VerdictIcon
                      className={`h-5 w-5 shrink-0 ${verdictVisual.textClassName}`}
                      aria-hidden="true"
                    />
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
