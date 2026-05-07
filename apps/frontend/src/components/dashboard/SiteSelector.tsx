import { useId, useMemo, useState } from 'react';
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

function getSiteMeta(site: Site): string {
  return [site.orientation, site.elevation_m ? `${site.elevation_m}m` : null]
    .filter(Boolean)
    .join(' · ');
}

function getSiteSearchText(site: Site): string {
  return [
    site.name,
    site.code,
    site.region,
    site.orientation,
    site.elevation_m?.toString(),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function SiteSelector({
  selectedSiteId,
  onSelectSite,
  weatherData,
}: SiteSelectorProps) {
  const { t } = useTranslation();
  const { data: sites, isLoading, error } = useSites();
  const queryClient = useQueryClient();
  const searchInputId = useId();
  const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const filteredSites = useMemo(() => {
    const availableSites = sites ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return availableSites;

    return availableSites.filter((site) =>
      getSiteSearchText(site).includes(query)
    );
  }, [searchQuery, sites]);

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
          <div className="flex-1 min-w-[120px] p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-not-allowed text-gray-400 dark:text-gray-400">
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
          <div className="flex-1 min-w-[120px] p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-not-allowed text-gray-400 dark:text-gray-400">
            {t('common.loadingError')}
          </div>
        </div>
      </div>
    );
  }

  // Group sites by base name
  const siteGroups = groupSitesByBaseName(sites);
  const selectedSite = sites.find((site) => site.id === selectedSiteId);

  const handleMobileSelect = (siteId: string) => {
    onSelectSite(siteId);
    setIsMobileSelectorOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      <div className="md:hidden">
        <Button
          onClick={() => setIsMobileSelectorOpen((isOpen) => !isOpen)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-sky-100 bg-white p-3 text-left shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Site favori
            </span>
            <span className="block truncate text-base font-bold text-gray-950 dark:text-white">
              {selectedSite?.name ?? 'Choisir un site'}
            </span>
            {selectedSite && (
              <span className="mt-0.5 block text-sm text-gray-600 dark:text-gray-300">
                {getSiteMeta(selectedSite)}
              </span>
            )}
          </div>
          <span className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white">
            Changer
          </span>
        </Button>

        {isMobileSelectorOpen && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <label
              htmlFor={searchInputId}
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              Rechercher
            </label>
            <input
              id={searchInputId}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Nom, orientation, altitude..."
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-sky-900"
            />

            <div className="mt-3 max-h-[55vh] space-y-1 overflow-y-auto overscroll-contain pr-1">
              {filteredSites.length > 0 ? (
                filteredSites.map((site) => {
                  const isActive = selectedSiteId === site.id;
                  const meta = getSiteMeta(site);

                  return (
                    <Button
                      key={site.id}
                      onClick={() => handleMobileSelect(site.id)}
                      onMouseEnter={() => handleMouseEnter(site.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                        isActive
                          ? 'bg-sky-50 text-sky-900 ring-2 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-100 dark:ring-sky-700'
                          : 'text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-900'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {site.name}
                        </span>
                        {meta && (
                          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                            {meta}
                          </span>
                        )}
                      </span>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-sky-600 px-2 py-0.5 text-xs font-bold text-white">
                          Actif
                        </span>
                      )}
                    </Button>
                  );
                })
              ) : (
                <div className="rounded-xl bg-gray-50 px-3 py-5 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  Aucun site trouvé
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="hidden gap-2 flex-wrap rounded-xl bg-white p-3 shadow-md dark:bg-gray-800 md:flex">
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
