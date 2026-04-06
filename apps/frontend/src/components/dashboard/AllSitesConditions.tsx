import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { WindIndicator } from '../common/WindIndicator';
import CacheTimestamp from '../common/CacheTimestamp';
import type { WeatherData } from '../../types';
import type { Site } from '@dashboard-parapente/shared-types';

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

export interface SiteWeatherEntry {
  site: Site;
  weather: WeatherData | undefined;
  isLoading: boolean;
  isError: boolean;
}

interface AllSitesConditionsProps {
  entries: SiteWeatherEntry[];
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
      onClick={handleClick}
      className="w-full text-left bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700 hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-lg transition-all cursor-pointer"
    >
      {/* Site name + orientation */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
          {site.name}
        </h3>
        {site.orientation && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium ml-2 shrink-0">
            {site.orientation}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="py-4 text-center text-gray-400 text-sm">
          {t('common.loading')}
        </div>
      )}

      {isError && (
        <div className="py-4 text-center text-red-400 text-sm">
          {t('weather.loadError')}
        </div>
      )}

      {weather && !isLoading && (
        <>
          {/* Score + verdict */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl font-bold text-sky-600">
              {weather.score != null ? weather.score : weather.para_index}
            </span>
            <span className="text-sm text-gray-400">/100</span>
            <span
              className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${getVerdictClass(weather.verdict)}`}
            >
              {getVerdictEmoji(weather.verdict)} {weather.verdict.toUpperCase()}
            </span>
          </div>

          {/* Metrics */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">🌡️</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {weather.temperature}°C
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">💨</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {weather.wind_speed} km/h
                </span>
                {site.orientation && (
                  <WindIndicator
                    windDirection={weather.wind_direction}
                    siteOrientation={
                      Array.isArray(site.orientation)
                        ? site.orientation[0]
                        : site.orientation
                    }
                    windSpeed={weather.wind_speed}
                    showLabel={false}
                    size="sm"
                  />
                )}
              </div>
            </div>
            {weather.conditions && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">☁️</span>
                <span className="font-medium text-gray-900 dark:text-white truncate ml-2">
                  {weather.conditions}
                </span>
              </div>
            )}
          </div>

          {/* Cache timestamp */}
          <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <CacheTimestamp cachedAt={weather.cached_at} />
          </div>
        </>
      )}
    </button>
  );
}

export default function AllSitesConditions({
  entries,
}: AllSitesConditionsProps) {
  const { t } = useTranslation();

  if (entries.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-semibold">
        {t(
          'dashboard.allSitesConditions',
          'Conditions actuelles — tous les sites'
        )}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {entries.map((entry) => (
          <SiteConditionCard key={entry.site.id} {...entry} />
        ))}
      </div>
    </div>
  );
}
