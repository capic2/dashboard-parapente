import { useTranslation } from 'react-i18next';
import { getStaleTime } from '../../lib/cacheConfig';
import {
  useDailySummary,
  createWeatherQueryFn,
} from '../../hooks/weather/useWeather';
import { useQueryClient } from '@tanstack/react-query';
import CacheTimestamp from '../common/CacheTimestamp';
import { Button } from '@dashboard-parapente/design-system';
import { Wind } from 'lucide-react';
import {
  getVerdictVisual,
  weatherCardClassName,
  weatherSectionTitleClassName,
} from './weatherUi';

interface Forecast7DayProps {
  spotId: string;
  selectedDayIndex?: number;
  onSelectDay?: (index: number) => void;
}

export default function Forecast7Day({
  spotId,
  selectedDayIndex = 0,
  onSelectDay,
}: Forecast7DayProps) {
  const { t, i18n } = useTranslation();

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return t('common.today');
    if (date.toDateString() === tomorrow.toDateString())
      return t('common.tomorrow');

    return date.toLocaleDateString(
      i18n.language.startsWith('en') ? 'en-US' : 'fr-FR',
      {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }
    );
  };
  // OPTIMISATION: Use daily summary instead of full weather data
  // This loads 7 days of aggregate data (para_index, temps, wind) WITHOUT hourly details
  // → 2-3x faster than loading full hourly forecasts
  const { data: dailySummary, isLoading, error } = useDailySummary(spotId);
  const queryClient = useQueryClient();

  // Prefetch full hourly data on hover for instant navigation
  // Uses the SAME transformation logic as useWeather (shared queryFn)
  const handleMouseEnter = (dayIndex: number) => {
    if (!spotId || dayIndex === selectedDayIndex) return;

    queryClient.prefetchQuery({
      queryKey: ['weather', 'combined', spotId, dayIndex],
      queryFn: createWeatherQueryFn(spotId, dayIndex),
      staleTime: getStaleTime(1000 * 60 * 5),
    });
  };

  if (isLoading) {
    return (
      <div className={`${weatherCardClassName} p-4`} aria-live="polite">
        <h2 className={weatherSectionTitleClassName}>
          {t('weather.forecast7Days')}
        </h2>
        <div className="py-5 text-center text-gray-500 dark:text-gray-400 text-sm">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (error || !dailySummary || !dailySummary.days) {
    return (
      <div className={`${weatherCardClassName} p-4`} role="alert">
        <h2 className={weatherSectionTitleClassName}>
          {t('weather.forecast7Days')}
        </h2>
        <div className="py-5 text-center text-red-500 dark:text-red-400 text-sm">
          {t('common.dataUnavailable')}
        </div>
      </div>
    );
  }

  return (
    <div className={`${weatherCardClassName} min-w-0 p-4 sm:p-5`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className={weatherSectionTitleClassName}>
            {t('weather.forecast7Days')}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Sélectionnez une journée pour charger le détail horaire.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CacheTimestamp cachedAt={dailySummary.cached_at} />
        </div>
      </div>

      <div className="flex max-w-full min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 scrollbar-thin sm:grid sm:grid-cols-2 sm:overflow-x-visible sm:pb-0 sm:snap-none md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {dailySummary.days.map((day, index) => {
          const isSelected = index === selectedDayIndex;
          const verdictVisual = getVerdictVisual(day.verdict);
          const VerdictIcon = verdictVisual.Icon;

          return (
            <Button
              key={index}
              onClick={() => onSelectDay?.(index)}
              onMouseEnter={() => handleMouseEnter(index)}
              className={`relative min-h-[158px] min-w-[150px] flex-shrink-0 snap-start rounded-2xl border p-3 text-left transition-colors hover:border-sky-500 hover:bg-sky-50/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:bg-sky-950/30 sm:min-w-0 sm:flex-shrink ${
                isSelected
                  ? 'border-sky-600 bg-sky-50 shadow-lg ring-2 ring-sky-200 dark:bg-sky-900/20 dark:ring-sky-700'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
              }`}
            >
              {isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-sky-600 rounded-full" />
              )}
              <div className="flex h-full flex-col justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  {formatDate(day.date)}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-3xl font-black leading-none text-sky-600 dark:text-sky-400">
                    {day.score ?? day.para_index}
                  </span>
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 ${verdictVisual.badgeClassName}`}
                  >
                    <VerdictIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  {day.temp_min}° - {day.temp_max}°
                </div>
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  <Wind
                    className="h-3.5 w-3.5 text-sky-500"
                    aria-hidden="true"
                  />
                  {Math.round(day.wind_avg)} km/h
                </div>
                <div className="min-h-8 break-words text-xs leading-tight text-gray-500 dark:text-gray-400">
                  {day.verdict}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
