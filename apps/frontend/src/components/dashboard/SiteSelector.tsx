import { useTranslation } from 'react-i18next';
import { getStaleTime } from '../../lib/cacheConfig';
import { useSites } from '../../hooks/sites/useSites';
import { MultiOrientationSelector } from './MultiOrientationSelector';
import { useQueryClient } from '@tanstack/react-query';
import { createWeatherQueryFn } from '../../hooks/weather/useWeather';
import type { Site } from '../../types';
import { Button } from '@dashboard-parapente/design-system';

interface SiteSelectorProps {
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  weatherData?: Map<
    string,
    { windDirection?: string; windSpeed?: number; paraIndex?: number }
  >;
}

/**
 * Group sites by their base name (e.g., "Mont Poupet Nord", "Mont Poupet Sud" -> grouped as "mont-poupet")
 * Returns: { "mont-poupet": [site1, site2], "arguel": [site3], ... }
 */
function groupSitesByBaseName(sites: Site[]): Record<string, Site[]> {
  const groups: Record<string, Site[]> = {};

  for (const site of sites) {
    // Extract base identifier from site.id (everything before the last hyphen if it's an orientation)
    // e.g., "mont-poupet-nord" -> "mont-poupet", "arguel" -> "arguel"
    const parts = site.id.split('-');
    const lastPart = parts[parts.length - 1];

    // Check if last part is an orientation indicator
    const orientations = [
      'nord',
      'sud',
      'est',
      'ouest',
      'n',
      's',
      'e',
      'w',
      'ne',
      'nw',
      'se',
      'sw',
    ];
    const isOrientation = orientations.includes(lastPart.toLowerCase());

    const baseId = isOrientation ? parts.slice(0, -1).join('-') : site.id;

    if (!groups[baseId]) {
      groups[baseId] = [];
    }
    groups[baseId].push(site);
  }

  return groups;
}

export default function SiteSelector({
  selectedSiteId,
  onSelectSite,
  weatherData,
}: SiteSelectorProps) {
  const { t } = useTranslation();
  const { data: sites, isLoading, error } = useSites();
  const queryClient = useQueryClient();

  // Prefetch site weather on hover (instant navigation)
  const handleMouseEnter = (siteId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['weather', 'combined', siteId, 0], // dayIndex=0 (today)
      queryFn: createWeatherQueryFn(siteId, 0),
      staleTime: getStaleTime(1000 * 60 * 5),
    });
  };

  if (isLoading) {
    return (
      <div className="mb-4">
        <div className="flex gap-2 flex-wrap bg-white dark:bg-gray-800 rounded-xl p-3 shadow-md">
          <div className="flex-1 min-w-[120px] p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-not-allowed text-gray-400 dark:text-gray-500">
            {t('common.loading')}
          </div>
        </div>
      </div>
    );
  }

  if (error || !sites) {
    return (
      <div className="mb-4">
        <div className="flex gap-2 flex-wrap bg-white dark:bg-gray-800 rounded-xl p-3 shadow-md">
          <div className="flex-1 min-w-[120px] p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-not-allowed text-gray-400 dark:text-gray-500">
            {t('common.loadingError')}
          </div>
        </div>
      </div>
    );
  }

  // Group sites by base name
  const siteGroups = groupSitesByBaseName(sites);

  return (
    <div className="mb-4 sticky top-0 z-10">
      <div className="flex gap-2 flex-wrap bg-white dark:bg-gray-800 rounded-xl p-3 shadow-md">
        {Object.entries(siteGroups).map(([baseId, groupSites]) => {
          // Single site -> regular button
          if (groupSites.length === 1) {
            const site = groupSites[0];
            const isActive = selectedSiteId === site.id;

            return (
              <Button
                key={site.id}
                className={`
                  flex-1 min-w-[120px] sm:min-w-[100px] 
                  p-3 sm:p-2.5 
                  border-2 rounded-lg 
                  transition-all 
                  flex flex-col items-center gap-1
                  ${
                    isActive
                      ? 'border-sky-600 bg-gradient-to-br from-sky-600 to-sky-800 text-white'
                      : 'border-gray-200 bg-white dark:bg-gray-700 dark:border-gray-600 hover:border-sky-600 hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-100'
                  }
                `}
                onClick={() => onSelectSite(site.id)}
                onMouseEnter={() => handleMouseEnter(site.id)}
              >
                <span
                  className={`text-sm sm:text-xs font-semibold ${isActive ? '' : 'text-gray-900 dark:text-gray-100'}`}
                >
                  {site.name}
                </span>
                <span
                  className={`text-xs sm:text-[11px] ${isActive ? 'opacity-90' : 'opacity-80 text-gray-600 dark:text-gray-400'}`}
                >
                  {site.elevation_m || '?'}m
                </span>
              </Button>
            );
          }

          // Multiple sites with same base -> dropdown selector
          return (
            <MultiOrientationSelector
              key={baseId}
              sites={groupSites}
              selectedSiteId={selectedSiteId}
              onSelectSite={onSelectSite}
              weatherData={weatherData}
              className="flex-1 min-w-[120px] sm:min-w-[100px]"
            />
          );
        })}
      </div>
    </div>
  );
}
