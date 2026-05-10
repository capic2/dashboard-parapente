import { useTranslation } from 'react-i18next';
import { useWeather } from '../../hooks/weather/useWeather';
import { useSite } from '../../hooks/sites/useSites';
import { WindIndicator } from '../common/WindIndicator';
import CacheTimestamp from '../common/CacheTimestamp';
import type { WeatherData } from '../../types';
import { Cloud, Thermometer, Wind, Zap } from 'lucide-react';
import { getVerdictVisual, weatherCardClassName } from './weatherUi';

interface CurrentConditionsProps {
  spotId?: string;
  dayIndex?: number;
  weatherData?: WeatherData;
  siteOrientation?: string | null;
  isLoading?: boolean;
  isError?: boolean;
}

export default function CurrentConditions({
  spotId,
  dayIndex = 0,
  weatherData,
  siteOrientation,
  isLoading: isOverrideLoading,
  isError: isOverrideError,
}: CurrentConditionsProps) {
  const { t } = useTranslation();
  const {
    data: fetchedWeather,
    isLoading: isFetchedLoading,
    error,
  } = useWeather(weatherData ? undefined : spotId, dayIndex);
  const { data: site } = useSite(spotId ?? '');
  const weather = weatherData ?? fetchedWeather;
  const isLoading = isOverrideLoading ?? isFetchedLoading;
  const hasError = isOverrideError ?? !!error;
  const orientation = siteOrientation ?? site?.orientation;
  const cardClassName = `${weatherCardClassName} border-l-4 border-l-sky-600 p-4`;

  if (isLoading) {
    return (
      <div className={cardClassName} aria-live="polite">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3.5 font-semibold">
          {t('weather.currentConditions')}
        </h2>
        <div className="py-5 text-center text-gray-500 dark:text-gray-400 text-sm">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (hasError || !weather) {
    return (
      <div className={cardClassName} role="alert">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3.5 font-semibold">
          {t('weather.currentConditions')}
        </h2>
        <div className="py-5 text-center text-red-500 dark:text-red-400 text-sm">
          {t('weather.loadError')}
        </div>
      </div>
    );
  }

  const verdictVisual = getVerdictVisual(weather.verdict);
  const VerdictIcon = verdictVisual.Icon;

  return (
    <div className={`${cardClassName} flex flex-1 flex-col`}>
      <div className="mb-3.5">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
          {t('weather.currentConditionsFor', { name: weather.spot_name })}
        </h2>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="text-4xl sm:text-3xl font-bold text-sky-600 dark:text-sky-400 leading-none">
          {weather.score != null ? weather.score : weather.para_index}/100
        </div>
        <div
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${verdictVisual.badgeClassName}`}
        >
          <VerdictIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {weather.verdict.toUpperCase()}
        </div>
      </div>
      {weather.score != null && weather.score !== weather.para_index && (
        <div className="text-xs text-gray-500 dark:text-gray-400 -mt-3 mb-3">
          {t('weather.paraIndex')} {weather.para_index}/100
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-700">
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium">
            <Thermometer className="h-4 w-4 text-red-500" aria-hidden="true" />
            {t('common.temperature')}
          </span>
          <span className="font-semibold text-gray-900 dark:text-white text-right">
            {weather.temperature}°C
          </span>
        </div>
        <div className="flex justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-700">
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium">
            <Wind className="h-4 w-4 text-sky-500" aria-hidden="true" />
            {t('common.wind')}
          </span>
          <div className="flex flex-col items-end gap-1">
            <span className="font-semibold text-gray-900 dark:text-white text-right">
              {weather.wind_speed} km/h {weather.wind_direction}
            </span>
            {orientation && (
              <WindIndicator
                windDirection={weather.wind_direction}
                siteOrientation={
                  Array.isArray(orientation) ? orientation[0] : orientation
                }
                windSpeed={weather.wind_speed}
                showLabel={false}
                size="sm"
              />
            )}
          </div>
        </div>
        {weather.wind_gusts && (
          <div className="flex justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-700">
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium">
              <Zap className="h-4 w-4 text-orange-500" aria-hidden="true" />
              {t('common.gusts')}
            </span>
            <span className="font-semibold text-gray-900 dark:text-white text-right">
              {weather.wind_gusts} km/h
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm py-1.5">
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium">
            <Cloud className="h-4 w-4 text-slate-500" aria-hidden="true" />
            {t('common.conditions')}
          </span>
          <span className="font-semibold text-gray-900 dark:text-white text-right">
            {weather.conditions}
          </span>
        </div>
      </div>

      <div className="mt-3 text-center pt-2 border-t border-gray-100 dark:border-gray-700">
        <CacheTimestamp cachedAt={weather.cached_at} />
      </div>
    </div>
  );
}
