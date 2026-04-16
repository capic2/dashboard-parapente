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
import CacheTimestamp from '../common/CacheTimestamp';
import { enUS } from 'date-fns/locale';
import { WindIndicator } from '../common/WindIndicator';
import { Button } from '@dashboard-parapente/design-system';
import type { BestSpotResult } from '@dashboard-parapente/shared-types';

interface BestSpotSuggestionProps {
  bestSpot: BestSpotResult | null;
  onSelectSite: (siteId: string) => void;
  selectedDayIndex?: number;
  className?: string;
}

/** Returns color classes based on Para-Index score */
function getScoreColor(score: number) {
  if (score >= 70)
    return {
      bg: 'bg-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: 'ring-emerald-200 dark:ring-emerald-800',
    };
  if (score >= 50)
    return {
      bg: 'bg-sky-500',
      text: 'text-sky-600 dark:text-sky-400',
      ring: 'ring-sky-200 dark:ring-sky-800',
    };
  if (score >= 30)
    return {
      bg: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-200 dark:ring-amber-800',
    };
  return {
    bg: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    ring: 'ring-red-200 dark:ring-red-800',
  };
}

/** Returns verdict label and color */
function getVerdict(paraIndex: number, verdict?: string) {
  if (verdict) {
    const v = verdict.toUpperCase();
    if (v === 'EXCELLENT' || v === 'EXCELLENTES')
      return {
        label: 'Excellent',
        className:
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      };
    if (v === 'BON' || v === 'BONNES')
      return {
        label: 'Bon',
        className:
          'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
      };
    if (v === 'MOYEN' || v === 'MOYENNES')
      return {
        label: 'Moyen',
        className:
          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      };
    return {
      label: 'Limite',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    };
  }
  if (paraIndex >= 70)
    return {
      label: 'Excellent',
      className:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    };
  if (paraIndex >= 50)
    return {
      label: 'Bon',
      className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    };
  if (paraIndex >= 30)
    return {
      label: 'Moyen',
      className:
        'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    };
  return {
    label: 'Limite',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  };
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

  const {
    site,
    paraIndex,
    score,
    windDirection,
    windSpeed,
    reason,
    flyableSlot,
    thermalCeiling,
    verdict,
    windFavorability,
  } = bestSpot;
  const adjustedScore = Math.min(
    100,
    Math.max(0, score != null ? Math.round(score) : paraIndex)
  );
  const scoreColor = getScoreColor(adjustedScore);
  const verdictInfo = getVerdict(adjustedScore, verdict ?? undefined);

  return (
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden ${className}`}
    >
      {/* Header with colored accent bar */}
      <div className={`h-1.5 ${scoreColor.bg}`} />

      <div className="p-4">
        {/* Top row: title + verdict badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('weather.bestSpotFor', { date: dateLabel })}
            </h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${verdictInfo.className}`}
          >
            {verdictInfo.label}
          </span>
        </div>

        {/* Site name + rating */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            {site.name}
          </span>
          {site.rating != null && site.rating > 0 && (
            <span className="text-sm text-amber-500">
              {'★'.repeat(site.rating)}
              {'☆'.repeat(5 - site.rating)}
            </span>
          )}
          {site.orientation && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
              {site.orientation}
            </span>
          )}
        </div>

        {/* Score gauge */}
        <div className="mb-4">
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t('weather.score')}
            </span>
            <span className={`text-2xl font-bold ${scoreColor.text}`}>
              {adjustedScore}
              <span className="text-sm font-normal text-gray-400">/100</span>
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreColor.bg} transition-all duration-500`}
              style={{ width: `${adjustedScore}%` }}
            />
          </div>
          {score != null && score !== paraIndex && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('weather.paraIndex')} {paraIndex}/100
            </div>
          )}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Wind */}
          <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/30 rounded-lg p-2.5">
            {windDirection && windSpeed != null ? (
              <WindIndicator
                windDirection={windDirection}
                siteOrientation={site.orientation ?? undefined}
                windSpeed={windSpeed}
                size="sm"
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>💨</span>
                <span>—</span>
              </div>
            )}
          </div>

          {/* Flyable slot */}
          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">🕐</span>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('weather.flyableSlot')}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {flyableSlot || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Thermal ceiling */}
          {thermalCeiling != null && (
            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">☁️</span>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('weather.thermalCeiling')}
                  </span>
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                    {thermalCeiling}m
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Wind favorability badge */}
          {windFavorability && (
            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {windFavorability === 'good'
                    ? '✅'
                    : windFavorability === 'moderate'
                      ? '⚠️'
                      : '❌'}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Vent / Orientation
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      windFavorability === 'good'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : windFavorability === 'moderate'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {windFavorability === 'good'
                      ? 'Favorable'
                      : windFavorability === 'moderate'
                        ? 'Modéré'
                        : 'Défavorable'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reason text */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
          {reason}
        </p>

        {/* Footer: button + cache */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Button
            onClick={() => onSelectSite(site.id)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            {t('weather.viewForecast')}
          </Button>
          <CacheTimestamp cachedAt={bestSpot.cached_at} />
        </div>
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

  const { site, paraIndex, score, windDirection, windSpeed } = bestSpot;
  const adjustedScore = score != null ? Math.round(score) : paraIndex;
  const scoreColor = getScoreColor(adjustedScore);

  return (
    <Button
      onClick={() => onSelectSite(site.id)}
      className={`w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors overflow-hidden ${className}`}
    >
      <div className={`h-1 ${scoreColor.bg} -mt-3 -mx-3 mb-2`} />
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
          🎯 {t('weather.recommended')}
        </span>
        {windDirection && windSpeed != null && (
          <WindIndicator
            windDirection={windDirection}
            siteOrientation={site.orientation ?? undefined}
            windSpeed={windSpeed}
            showLabel={false}
            size="sm"
          />
        )}
      </div>
      <div className="font-bold text-gray-900 dark:text-white">{site.name}</div>
      <div className="flex items-center gap-2 mt-1">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${scoreColor.bg}`}
            style={{ width: `${adjustedScore}%` }}
          />
        </div>
        <span className={`text-sm font-bold ${scoreColor.text}`}>
          {adjustedScore}
        </span>
      </div>
    </Button>
  );
}
