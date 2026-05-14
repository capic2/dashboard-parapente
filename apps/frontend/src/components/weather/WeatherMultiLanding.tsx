import { useTranslation } from 'react-i18next';
import {
  useLandingAssociations,
  useLandingWeather,
} from '../../hooks/sites/useLandingAssociations';
import {
  getVerdictVisual,
  weatherCardClassName,
  weatherSectionTitleClassName,
} from './weatherUi';

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

  const content = (() => {
    if (isLoading) {
      return (
        <div
          className="py-3 text-center text-gray-500 dark:text-gray-400 text-sm"
          aria-live="polite"
        >
          {t('weather.loadingLandings')}
        </div>
      );
    }

    if (!weatherData || weatherData.length === 0) {
      return (
        <div className="py-3 text-center text-gray-400 dark:text-gray-400 text-sm">
          {t('weather.noWeatherData')}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {weatherData.map((entry) => {
          const weather = entry.weather;
          const hasError = !!weather.error;
          const verdict = weather.verdict || '';
          const verdictVisual = getVerdictVisual(verdict);
          const VerdictIcon = verdictVisual.Icon;

          return (
            <div
              key={entry.landing_site_id}
              className={`rounded-2xl border border-l-4 p-3 shadow-sm ${
                hasError
                  ? 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800'
                  : verdictVisual.borderSoftClassName
              } ${entry.is_primary ? 'ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900' : ''}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="truncate text-sm font-black text-gray-900 dark:text-gray-100">
                  {entry.landing_site_name}
                </h3>
                <span className="ml-2 flex-shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-slate-950/40 dark:text-gray-300">
                  {entry.distance_km == null ? '' : `${entry.distance_km} km`}
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
                <span className="mt-3 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  {t('weather.primary')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  })();

  return (
    <div
      className={`${weatherCardClassName} border-l-4 border-l-indigo-500 p-4 sm:p-5`}
    >
      <div className="mb-4">
        <h2 className={weatherSectionTitleClassName}>
          {t('weather.landings')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Conditions aux atterrissages associés au site sélectionné.
        </p>
      </div>

      {content}
    </div>
  );
}
