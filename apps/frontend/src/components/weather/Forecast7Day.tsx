import { useTranslation } from 'react-i18next';
import { getStaleTime } from '../../lib/cacheConfig';
import {
  useDailySummary,
  createWeatherQueryFn,
} from '../../hooks/weather/useWeather';
import { useQueryClient } from '@tanstack/react-query';
import CacheTimestamp from '../common/CacheTimestamp';

interface Forecast7DayProps {
  spotId: string;
  selectedDayIndex?: number;
  onSelectDay?: (index: number) => void;
}

const getVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon')
    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
  if (v === 'moyen')
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
  if (v === 'limite')
    return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
  return 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100';
};

const getVerdictEmoji = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon') return '🟢';
  if (v === 'moyen') return '🟡';
  if (v === 'limite') return '🟠';
  return '🔴';
};

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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-semibold">
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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-semibold">
          {t('weather.forecast7Days')}
        </h2>
        <div className="py-5 text-center text-red-500 text-sm">
          {t('common.dataUnavailable')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
          {t('weather.forecast7Days')}
        </h2>
        <CacheTimestamp cachedAt={dailySummary.cached_at} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {dailySummary.days.map((day, index) => {
          const isSelected = index === selectedDayIndex;

          return (
            <button
              key={index}
              onClick={() => onSelectDay?.(index)}
              onMouseEnter={() => handleMouseEnter(index)}
              className={`bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border-2 transition-all hover:border-sky-600 hover:-translate-y-1 hover:shadow-md cursor-pointer relative ${
                isSelected
                  ? 'border-sky-600 shadow-lg bg-sky-50 dark:bg-sky-900/20 ring-2 ring-sky-200 dark:ring-sky-700'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-sky-600 rounded-full" />
              )}
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 text-center">
                {formatDate(day.date)}
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl font-bold text-sky-600">
                  {day.score != null ? day.score : day.para_index}
                </span>
                <span
                  className={`text-xl ${getVerdictClass(day.verdict)} px-1.5 py-0.5 rounded-full`}
                >
                  {getVerdictEmoji(day.verdict)}
                </span>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 font-medium text-center mb-1">
                {day.temp_min}° - {day.temp_max}°
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 text-center mb-1">
                💨 {Math.round(day.wind_avg)} km/h
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center truncate">
                {day.verdict}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
