import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Cloud, RefreshCw, Thermometer, Wind } from 'lucide-react';
import { Button } from '@dashboard-parapente/design-system';
import { WindIndicator } from '../common/WindIndicator';
import CacheTimestamp from '../common/CacheTimestamp';
import WindArrow from '../weather/WindArrow';
import type { WeatherData } from '../../types';
import type { Site } from '@dashboard-parapente/shared-types';
import { getSiteDisplayName } from '../../lib/siteDisplay';

const getVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon')
    return 'bg-emerald-100 dark:bg-emerald-900/35 text-emerald-800 dark:text-emerald-200 ring-emerald-200 dark:ring-emerald-800';
  if (v === 'moyen')
    return 'bg-amber-100 dark:bg-amber-900/35 text-amber-800 dark:text-amber-200 ring-amber-200 dark:ring-amber-800';
  if (v === 'limite')
    return 'bg-orange-100 dark:bg-orange-900/35 text-orange-800 dark:text-orange-200 ring-orange-200 dark:ring-orange-800';
  return 'bg-red-100 dark:bg-red-900/35 text-red-900 dark:text-red-100 ring-red-200 dark:ring-red-800';
};

const getVerdictDotClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon') return 'bg-emerald-500';
  if (v === 'moyen') return 'bg-amber-500';
  if (v === 'limite') return 'bg-orange-500';
  return 'bg-red-500';
};

export interface SiteWeatherEntry {
  site: Site;
  weather: WeatherData | undefined;
  isLoading: boolean;
  isError: boolean;
}

interface AllSitesConditionsProps {
  entries: SiteWeatherEntry[];
  onRefresh?: () => void;
}

function SiteConditionCard({
  site,
  weather,
  isLoading,
  isError,
}: SiteWeatherEntry) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClick = () => {
    void navigate({ to: '/weather', search: { siteId: site.id } });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white/90 p-4 text-left shadow-md shadow-slate-200/50 transition-colors hover:border-sky-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/20 dark:hover:border-sky-700 dark:hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
    >
      {/* Site name + orientation */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-black text-slate-950 dark:text-white truncate">
          {getSiteDisplayName(site)}
        </span>
        {site.orientation && (
          <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {site.orientation}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
          {t('common.loading')}
        </div>
      )}

      {isError && (
        <div className="py-4 text-center text-red-500 dark:text-red-400 text-sm">
          {t('weather.loadError')}
        </div>
      )}

      {weather && !isLoading && (
        <>
          {/* Score + verdict */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-3xl font-black tracking-tight text-sky-600 dark:text-sky-400">
              {weather.score ?? weather.para_index}
            </span>
            <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
              /100
            </span>
            <span
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getVerdictClass(weather.verdict)}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${getVerdictDotClass(weather.verdict)}`}
                aria-hidden="true"
              />
              {weather.verdict.toUpperCase()}
            </span>
          </div>

          {/* Metrics */}
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Thermometer className="h-4 w-4" aria-hidden="true" />
                {t('common.temperature')}
              </span>
              <span className="font-bold text-slate-950 dark:text-white">
                {weather.temperature}°C
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Wind className="h-4 w-4" aria-hidden="true" />
                {t('common.wind')}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-950 dark:text-white">
                  {weather.wind_speed.toFixed(1)} km/h
                </span>
                {weather.wind_direction_deg != null && (
                  <WindArrow
                    degrees={weather.wind_direction_deg}
                    size={16}
                    className="text-slate-700 dark:text-slate-200"
                  />
                )}
                {site.orientation && (
                  <WindIndicator
                    windDirection={weather.wind_direction}
                    siteOrientation={site.orientation}
                    windSpeed={weather.wind_speed}
                    showLabel={false}
                    size="sm"
                  />
                )}
              </div>
            </div>
            {weather.conditions && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Cloud className="h-4 w-4" aria-hidden="true" />
                  {t('common.conditions')}
                </span>
                <span className="truncate text-right font-bold text-slate-950 dark:text-white">
                  {weather.conditions}
                </span>
              </div>
            )}
          </div>

          {/* Cache timestamp */}
          <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-700">
            <CacheTimestamp cachedAt={weather.cached_at} />
          </div>
        </>
      )}
    </button>
  );
}

export default function AllSitesConditions({
  entries,
  onRefresh,
}: AllSitesConditionsProps) {
  const { t } = useTranslation();
  const [showAllSites, setShowAllSites] = useState(false);
  const hasError = entries.some((entry) => entry.isError);

  if (entries.length === 0) return null;

  const rankedEntries = [...entries].sort((left, right) => {
    const leftScore = left.weather?.score ?? left.weather?.para_index ?? -1;
    const rightScore = right.weather?.score ?? right.weather?.para_index ?? -1;
    return rightScore - leftScore;
  });
  const visibleEntries = showAllSites
    ? rankedEntries
    : rankedEntries.slice(0, 4);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Cloud
            className="h-4 w-4 text-sky-600 dark:text-sky-400"
            aria-hidden="true"
          />
          {t(
            'dashboard.allSitesConditions',
            'Conditions actuelles — tous les sites'
          )}
        </h2>
        {hasError && onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onPress={onRefresh}
            aria-label={t('common.refresh')}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('common.refresh')}
          </Button>
        )}
      </div>
      {entries.length > 4 && (
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          {showAllSites
            ? t('dashboard.showingAllSites', { count: entries.length })
            : t('dashboard.showingTopSites', {
                count: visibleEntries.length,
                total: entries.length,
              })}
        </p>
      )}
      <div
        id="all-sites-conditions-list"
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
          visibleEntries.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
        } lg:grid-cols-3 xl:grid-cols-4`}
      >
        {visibleEntries.map((entry) => (
          <SiteConditionCard key={entry.site.id} {...entry} />
        ))}
      </div>
      {entries.length > 4 && (
        <button
          type="button"
          aria-expanded={showAllSites}
          aria-controls="all-sites-conditions-list"
          onClick={() => setShowAllSites((showAll) => !showAll)}
          className="mt-3 min-h-11 rounded-lg px-3 text-sm font-semibold text-sky-700 underline underline-offset-4 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
        >
          {showAllSites
            ? t('dashboard.showFewerSites')
            : t('dashboard.showAllSites', { count: entries.length })}
        </button>
      )}
    </div>
  );
}
