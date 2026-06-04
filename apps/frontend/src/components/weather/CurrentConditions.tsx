import { useTranslation } from 'react-i18next';
import { useWeather } from '../../hooks/weather/useWeather';
import { useSite } from '../../hooks/sites/useSites';
import { WindIndicator } from '../common/WindIndicator';
import CacheTimestamp from '../common/CacheTimestamp';
import type { WeatherData } from '../../types';
import { Cloud, Thermometer, Wind, Zap } from 'lucide-react';
import {
  getVerdictVisual,
  weatherCardClassName,
  weatherMetricTileClassName,
  weatherSectionTitleClassName,
} from './weatherUi';

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
  const cardClassName = `${weatherCardClassName} overflow-hidden`;

  if (isLoading) {
    return (
      <div className={`${cardClassName} p-4`} aria-live="polite">
        <h2 className={weatherSectionTitleClassName}>
          {t('weather.currentConditions')}
        </h2>
        <div className="py-5 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (hasError || !weather) {
    return (
      <div className={`${cardClassName} p-4`} role="alert">
        <h2 className={weatherSectionTitleClassName}>
          {t('weather.currentConditions')}
        </h2>
        <div className="py-5 text-center text-sm text-red-500 dark:text-red-400">
          {t('weather.loadError')}
        </div>
      </div>
    );
  }

  const verdictVisual = getVerdictVisual(weather.verdict);
  const VerdictIcon = verdictVisual.Icon;

  return (
    <div className={`${cardClassName} flex flex-1 flex-col`}>
      <div className="border-l-4 border-l-sky-600 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className={weatherSectionTitleClassName}>
              {t('weather.currentConditions')}
            </p>
          </div>
          <div
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap ${verdictVisual.badgeClassName}`}
          >
            <VerdictIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {weather.verdict.toUpperCase()}
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-gradient-to-br from-sky-50 to-white p-4 dark:from-sky-950/40 dark:to-slate-950/40">
          <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Score météo
          </div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-5xl font-black leading-none tracking-tight text-sky-600 dark:text-sky-400">
              {weather.score ?? weather.para_index}
            </span>
            <span className="pb-1 text-lg font-bold text-slate-400 dark:text-slate-500">
              /100
            </span>
          </div>
        </div>
        {weather.score != null && weather.score !== weather.para_index && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('weather.paraIndex')} {weather.para_index}/100
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={weatherMetricTileClassName}>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
              <Thermometer
                className="h-4 w-4 text-red-500"
                aria-hidden="true"
              />
              {t('common.temperature')}
            </span>
            <div className="mt-1 text-lg font-black text-gray-900 dark:text-white">
              {weather.temperature}°C
            </div>
          </div>
          <div className={weatherMetricTileClassName}>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
              <Wind className="h-4 w-4 text-sky-500" aria-hidden="true" />
              {t('common.wind')}
            </span>
            <div className="mt-1 flex flex-col gap-1">
              <span className="text-lg font-black text-gray-900 dark:text-white">
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
            <div className={weatherMetricTileClassName}>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <Zap className="h-4 w-4 text-orange-500" aria-hidden="true" />
                {t('common.gusts')}
              </span>
              <div className="mt-1 text-lg font-black text-gray-900 dark:text-white">
                {weather.wind_gusts} km/h
              </div>
            </div>
          )}
          <div className={weatherMetricTileClassName}>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
              <Cloud className="h-4 w-4 text-slate-500" aria-hidden="true" />
              {t('common.conditions')}
            </span>
            <div className="mt-1 text-base font-black text-gray-900 dark:text-white">
              {weather.conditions}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-3 text-center dark:border-gray-700">
          <CacheTimestamp cachedAt={weather.cached_at} />
        </div>
      </div>
    </div>
  );
}
