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
import type { Locale } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cloud,
  Target,
  Wind,
  XCircle,
} from 'lucide-react';
import CacheTimestamp from '../common/CacheTimestamp';
import { enUS } from 'date-fns/locale';
import { WindIndicator } from '../common/WindIndicator';
import { Button } from '@dashboard-parapente/design-system';
import type { BestSpotResult } from '@dashboard-parapente/shared-types';

type HourlyBestSpot = BestSpotResult & { hour: number };

interface BestSpotSuggestionProps {
  bestSpot: BestSpotResult | null;
  hourlyBestSpots?: HourlyBestSpot[];
  hourlyStartHour?: number;
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

function getDateLabel(
  selectedDayIndex: number,
  selectedDate: Date,
  dateFnsLocale: Locale,
  t: (key: string) => string
) {
  if (selectedDayIndex === 0) return t('common.today').toLowerCase();
  if (selectedDayIndex === 1) return t('common.tomorrow').toLowerCase();
  return format(selectedDate, 'EEEE d MMMM', { locale: dateFnsLocale });
}

function getWindFavorabilityIcon(windFavorability: string) {
  if (windFavorability === 'good') {
    return (
      <CheckCircle2
        className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-hidden="true"
      />
    );
  }

  if (windFavorability === 'moderate') {
    return (
      <AlertTriangle
        className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
    );
  }

  return (
    <XCircle
      className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
      aria-hidden="true"
    />
  );
}

function getWindFavorabilityTextClass(windFavorability: string) {
  if (windFavorability === 'good')
    return 'text-emerald-600 dark:text-emerald-400';
  if (windFavorability === 'moderate')
    return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getWindFavorabilityLabel(
  windFavorability: string,
  t: (key: string) => string
) {
  if (windFavorability === 'good') return t('weather.favorabilityGood');
  if (windFavorability === 'moderate') return t('weather.favorabilityModerate');
  return t('weather.favorabilityPoor');
}

export const BestSpotSuggestion = ({
  bestSpot,
  hourlyBestSpots = [],
  hourlyStartHour,
  onSelectSite,
  selectedDayIndex = 0,
  className = '',
}: BestSpotSuggestionProps) => {
  const { t, i18n } = useTranslation();

  // Calculate the date label based on selectedDayIndex
  const selectedDate = addDays(new Date(), selectedDayIndex);
  const dateFnsLocale = i18n.language === 'en' ? enUS : fr;
  const dateLabel = getDateLabel(
    selectedDayIndex,
    selectedDate,
    dateFnsLocale,
    t
  );

  // Show loading state if no data available
  if (!bestSpot || !bestSpot.site) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
            <Target className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {t('weather.bestSpotFor', { date: dateLabel })}
            </h3>
            <div className="mt-1 text-lg font-bold text-slate-500 dark:text-slate-400">
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
    Math.max(0, Math.round(score ?? paraIndex))
  );
  const localizedReason = reason.replace(/Para-Index/g, t('weather.paraIndex'));
  const scoreColor = getScoreColor(adjustedScore);
  const verdictInfo = getVerdict(adjustedScore, verdict ?? undefined);

  return (
    <div
      className={`min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/25 ${className}`}
    >
      {/* Header with colored accent bar */}
      <div className={`h-1.5 ${scoreColor.bg}`} />

      <div className="min-w-0 p-4 md:p-5">
        {/* Top row: title + verdict badge */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
              <Target className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="truncate text-sm font-bold text-slate-600 dark:text-slate-300">
              {t('weather.bestSpotFor', { date: dateLabel })}
            </h3>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${verdictInfo.className}`}
          >
            {verdictInfo.label}
          </span>
        </div>

        {/* Site name + rating */}
        <div className="flex min-w-0 items-center gap-2 mb-4">
          <span className="min-w-0 truncate text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            {site.name}
          </span>
          {site.rating != null && site.rating > 0 && (
            <span className="text-sm text-amber-500 dark:text-amber-400">
              {'★'.repeat(site.rating)}
              {'☆'.repeat(5 - site.rating)}
            </span>
          )}
          {site.orientation && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {site.orientation}
            </span>
          )}
        </div>

        {/* Score gauge */}
        <div className="mb-4">
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {t('weather.score')}
            </span>
            <span className={`text-2xl font-bold ${scoreColor.text}`}>
              {adjustedScore}
              <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                /100
              </span>
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${scoreColor.bg} transition-all duration-500`}
              style={{ width: `${adjustedScore}%` }}
            />
          </div>
          {score != null && score !== paraIndex && (
            <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('weather.paraIndex')} {paraIndex}/100
            </div>
          )}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Wind */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/50">
            {windDirection && windSpeed != null ? (
              <WindIndicator
                windDirection={windDirection}
                siteOrientation={site.orientation ?? undefined}
                windSpeed={windSpeed}
                size="sm"
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-400">
                <Wind className="h-4 w-4" aria-hidden="true" />
                <span>—</span>
              </div>
            )}
          </div>

          {/* Flyable slot */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex items-center gap-2">
              <Clock3
                className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400"
                aria-hidden="true"
              />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('weather.flyableSlot')}
                </span>
                <span className="text-sm font-black text-slate-950 dark:text-white">
                  {flyableSlot || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Thermal ceiling */}
          {thermalCeiling != null && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Cloud
                  className="h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400"
                  aria-hidden="true"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('weather.thermalCeiling')}
                  </span>
                  <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                    {thermalCeiling}m
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Wind favorability badge */}
          {windFavorability && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center gap-2">
                {getWindFavorabilityIcon(windFavorability)}
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('weather.windOrientation')}
                  </span>
                  <span
                    className={`text-sm font-black ${getWindFavorabilityTextClass(windFavorability)}`}
                  >
                    {getWindFavorabilityLabel(windFavorability, t)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reason text */}
        <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {localizedReason}
        </p>

        {hourlyBestSpots.length > 0 && (
          <div className="mb-4 min-w-0 border-t border-slate-100 pt-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('weather.bestSpotTimeline')}
              </span>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {t('weather.byHour')}
              </span>
            </div>
            <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1">
              {hourlyBestSpots.map((hourlySpot) => {
                const hourlyScore = Math.min(
                  100,
                  Math.max(
                    0,
                    Math.round(hourlySpot.score ?? hourlySpot.paraIndex)
                  )
                );
                const hourlyScoreColor = getScoreColor(hourlyScore);
                const hourlyVerdict = getVerdict(
                  hourlyScore,
                  hourlySpot.verdict ?? undefined
                );
                const hourLabel =
                  selectedDayIndex === 0 && hourlySpot.hour === hourlyStartHour
                    ? t('common.now')
                    : `${hourlySpot.hour}h`;
                const roundedWindSpeed =
                  typeof hourlySpot.windSpeed === 'number'
                    ? Math.round(hourlySpot.windSpeed)
                    : null;
                const windLabel =
                  hourlySpot.windDirection && roundedWindSpeed != null
                    ? `${t('common.wind')} ${hourlySpot.windDirection} ${roundedWindSpeed} km/h`
                    : '—';
                const orientationLabel = hourlySpot.site?.orientation
                  ? `${t('sites.orientation')} ${hourlySpot.site.orientation}`
                  : null;

                return (
                  <Button
                    key={`${hourlySpot.hour}-${hourlySpot.site?.id ?? 'none'}`}
                    onClick={() => {
                      if (hourlySpot.site) {
                        onSelectSite(hourlySpot.site.id);
                      }
                    }}
                    className="min-w-[176px] cursor-pointer flex-col items-stretch justify-start gap-0 whitespace-normal rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-sm transition-colors hover:border-sky-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-sky-800 dark:hover:bg-slate-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-extrabold text-slate-950 dark:text-white">
                        {hourLabel}
                      </span>
                      <div className="text-right">
                        <span
                          className={`block text-xl font-black leading-none ${hourlyScoreColor.text}`}
                        >
                          {hourlyScore}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          /100
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${hourlyScoreColor.bg}`}
                        style={{ width: `${hourlyScore}%` }}
                      />
                    </div>
                    <div className="mt-2 truncate text-base font-black text-slate-950 dark:text-gray-50">
                      {hourlySpot.site?.name ?? '—'}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${hourlyVerdict.className}`}
                      >
                        {hourlyVerdict.label}
                      </span>
                      {orientationLabel && (
                        <span className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {orientationLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {windLabel}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer: button + cache */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Button
            onClick={() => onSelectSite(site.id)}
            className="cursor-pointer rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-sky-600/20 transition-colors hover:bg-sky-700"
          >
            {t('weather.viewForecast')}
          </Button>
          <CacheTimestamp cachedAt={bestSpot.cached_at} />
        </div>
      </div>
    </div>
  );
};

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
  const adjustedScore = Math.round(score ?? paraIndex);
  const scoreColor = getScoreColor(adjustedScore);

  return (
    <Button
      onClick={() => onSelectSite(site.id)}
      className={`w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 ${className}`}
    >
      <div className={`h-1 ${scoreColor.bg} -mt-3 -mx-3 mb-2`} />
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
          <Target className="h-3.5 w-3.5" aria-hidden="true" />
          {t('weather.recommended')}
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
