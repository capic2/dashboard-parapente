/**
 * BestSpotSuggestion Component
 *
 * Prominent card at the top of the dashboard showing the best spot to fly
 * Based on Para-Index and wind favorability
 *
 * Updated to support displaying the date for different days
 */

import { useTranslation } from 'react-i18next';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import CacheTimestamp from '../CacheTimestamp';
import { enUS } from 'date-fns/locale';
import { WindIndicatorCompact } from '../WindIndicator';
import type { BestSpotResult } from '@dashboard-parapente/shared-types';

interface BestSpotSuggestionProps {
  bestSpot: BestSpotResult | null;
  onSelectSite: (siteId: string) => void;
  selectedDayIndex?: number;
  className?: string;
}

export function BestSpotSuggestion({
  bestSpot,
  onSelectSite,
  selectedDayIndex = 0,
  className = '',
}: BestSpotSuggestionProps) {
  const { t, i18n } = useTranslation();

  // Calculate the date label based on selectedDayIndex
  const selectedDate = addDays(new Date(), selectedDayIndex);
  const dateFnsLocale = i18n.language === 'en' ? enUS : fr;
  const dateLabel =
    selectedDayIndex === 0
      ? t('common.today').toLowerCase()
      : selectedDayIndex === 1
        ? t('common.tomorrow').toLowerCase()
        : format(selectedDate, 'EEEE d MMMM', { locale: dateFnsLocale });

  // Show loading state if no data available
  if (!bestSpot || !bestSpot.site) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🎯</div>
          <div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t('weather.bestSpotFor', { date: dateLabel })}
            </h3>
            <div className="text-lg text-gray-500 dark:text-gray-500 mt-1">
              {t('weather.calculating')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { site, paraIndex, windDirection, windSpeed, reason, flyableSlot, thermalCeiling } = bestSpot;

  // Consistent sky blue theme for best spot card
  const bgColor = 'bg-sky-50 dark:bg-sky-900/20';
  const borderColor = 'border-sky-200 dark:border-sky-700';

  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-lg p-4 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between">
        {/* Left side: Icon and title */}
        <div className="flex items-center gap-3">
          <div className="text-3xl">🎯</div>
          <div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t('weather.bestSpotFor', { date: dateLabel })}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {site.name}
              </span>
              {site.rating && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {'⭐'.repeat(site.rating)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Wind indicator */}
        {windDirection && windSpeed != null && (
          <WindIndicatorCompact
            windDirection={windDirection}
            siteOrientation={site.orientation ?? undefined}
            windSpeed={windSpeed}
            className="text-2xl"
          />
        )}
      </div>

      {/* Metrics row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('weather.paraIndex')}
          </span>
          <span className="text-lg font-bold text-sky-600">
            {paraIndex}/100
          </span>
        </div>

        {windDirection && windSpeed != null && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('common.wind')}:
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {windDirection} {windSpeed}km/h
            </span>
          </div>
        )}

        {flyableSlot && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              🕐 {t('weather.flyableSlot')}:
            </span>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              {flyableSlot}
            </span>
          </div>
        )}

        {thermalCeiling && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              ☁️ {t('weather.thermalCeiling')}:
            </span>
            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
              {thermalCeiling}m
            </span>
          </div>
        )}
      </div>

      {/* Reason text */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{reason}</p>

      {/* Action button */}
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={() => onSelectSite(site.id)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          {t('weather.viewForecast')}
        </button>
        <CacheTimestamp cachedAt={bestSpot.cached_at} />
      </div>
    </div>
  );
}

/**
 * Compact version for sidebar or small spaces
 */
export function BestSpotSuggestionCompact({
  bestSpot,
  onSelectSite,
  className = '',
}: BestSpotSuggestionProps) {
  const { t } = useTranslation();

  if (!bestSpot || !bestSpot.site) {
    return null;
  }

  const { site, paraIndex, windDirection, windSpeed } = bestSpot;

  return (
    <button
      onClick={() => onSelectSite(site.id)}
      className={`w-full text-left p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
          🎯 {t('weather.recommended')}
        </span>
        {windDirection && windSpeed != null && (
          <WindIndicatorCompact
            windDirection={windDirection}
            siteOrientation={site.orientation ?? undefined}
            windSpeed={windSpeed}
          />
        )}
      </div>
      <div className="font-bold text-gray-900 dark:text-white">{site.name}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {t('weather.paraIndex')} {paraIndex}
      </div>
    </button>
  );
}
