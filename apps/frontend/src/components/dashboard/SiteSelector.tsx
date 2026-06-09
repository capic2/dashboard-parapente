import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStaleTime } from '../../lib/cacheConfig';
import { useSites } from '../../hooks/sites/useSites';
import { MultiOrientationSelector } from './MultiOrientationSelector';
import { useQueryClient } from '@tanstack/react-query';
import { createWeatherQueryFn } from '../../hooks/weather/useWeather';
import type { Site } from '../../types';
import { Button } from '@dashboard-parapente/design-system';
import { useAppSettingsStore } from '../../stores/appSettingsStore';
import { Check, MapPin, Mountain, Search } from 'lucide-react';
import { getSiteDisplayName } from '../../lib/siteDisplay';

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

function SiteMeta({ site, isActive }: { site: Site; isActive: boolean }) {
  return (
    <span
      className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${
        isActive ? 'text-sky-100' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      {site.orientation && (
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {site.orientation}
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Mountain className="h-3 w-3" aria-hidden="true" />
        {site.elevation_m ? `${site.elevation_m}m` : 'Altitude N/A'}
      </span>
    </span>
  );
}

function getSiteSearchText(site: Site): string {
  return [
    site.name,
    getSiteDisplayName(site),
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
  const favoriteSiteIds = useAppSettingsStore(
    (state) => state.settings.favoriteSites
  );
  const queryClient = useQueryClient();
  const searchInputId = useId();
  const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const visibleSites = useMemo(() => {
    const availableSites = sites ?? [];
    if (favoriteSiteIds.length === 0) return availableSites;

    const favoriteSet = new Set(favoriteSiteIds);
    const matchedFavorites = availableSites.filter((site) =>
      favoriteSet.has(site.id)
    );
    return matchedFavorites.length > 0 ? matchedFavorites : availableSites;
  }, [favoriteSiteIds, sites]);
  const filteredSites = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return visibleSites;

    return visibleSites.filter((site) =>
      getSiteSearchText(site).includes(query)
    );
  }, [searchQuery, visibleSites]);

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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
        {t('common.loading')}
      </div>
    );
  }

  if (error || !sites) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        {t('common.loadingError')}
      </div>
    );
  }

  // Group sites by base name
  const siteGroups = groupSitesByBaseName(visibleSites);
  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const selectedSiteDisplayName = selectedSite
    ? getSiteDisplayName(selectedSite)
    : null;

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
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-700 dark:hover:bg-sky-950/30"
        >
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              Site sélectionné
            </span>
            <span className="block truncate text-base font-bold text-gray-950 dark:text-white">
              {selectedSiteDisplayName ?? 'Choisir un site'}
            </span>
            {selectedSite && (
              <span className="mt-0.5 block text-sm text-gray-600 dark:text-gray-300">
                {getSiteMeta(selectedSite)}
              </span>
            )}
          </div>
          <span className="shrink-0 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-900/20">
            Changer
          </span>
        </Button>

        {isMobileSelectorOpen && (
          <div className="absolute left-0 right-0 top-full z-30 mt-3 rounded-3xl border-2 border-sky-500 bg-sky-100 p-3 shadow-[0_24px_70px_rgba(2,132,199,0.35)] ring-8 ring-sky-500/20 dark:border-sky-400 dark:bg-sky-950 dark:shadow-[0_24px_70px_rgba(0,0,0,0.75)] dark:ring-sky-400/25">
            <div className="mb-3 rounded-2xl bg-sky-700 px-3 py-2 text-white shadow-sm shadow-sky-950/20 dark:bg-sky-500 dark:text-slate-950">
              <span className="text-xs font-black uppercase tracking-[0.18em]">
                Menu de sélection
              </span>
            </div>
            <label
              htmlFor={searchInputId}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-sky-900 dark:text-sky-100"
            >
              <Search className="h-3 w-3" aria-hidden="true" />
              Rechercher
            </label>
            <input
              id={searchInputId}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Nom, orientation, altitude..."
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-sky-900"
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
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        isActive
                          ? 'border-sky-500 bg-sky-600 text-white shadow-sm shadow-sky-900/20 dark:border-sky-400 dark:bg-sky-600'
                          : 'border-sky-200 bg-white text-slate-900 shadow-sm shadow-sky-900/10 hover:border-sky-500 hover:bg-white dark:border-sky-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-400 dark:hover:bg-slate-900'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {getSiteDisplayName(site)}
                        </span>
                        {meta && <SiteMeta site={site} isActive={isActive} />}
                      </span>
                      {isActive && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold text-white ring-1 ring-white/20">
                          <Check className="h-3 w-3" aria-hidden="true" />
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

      <div className="hidden md:block">
        <div className="mb-2 flex items-center justify-between gap-3 px-1 text-xs text-slate-500 dark:text-slate-400">
          <span>{visibleSites.length} sites disponibles</span>
          {selectedSite && (
            <span className="truncate font-semibold text-sky-700 dark:text-sky-300">
              Actuel: {selectedSiteDisplayName}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-950/40 lg:grid-cols-2">
          {Object.entries(siteGroups).map(([baseId, groupSites]) => {
            // Single site -> regular button
            if (groupSites.length === 1) {
              const site = groupSites[0];
              const isActive = selectedSiteId === site.id;

              return (
                <Button
                  key={site.id}
                  className={`
                  min-w-0 rounded-xl border p-3 text-left transition-colors
                  flex flex-col items-start gap-1 cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500
                  ${
                    isActive
                      ? 'border-sky-500 bg-gradient-to-br from-sky-600 to-sky-800 text-white shadow-md shadow-sky-900/20'
                      : 'border-slate-200 bg-white text-slate-900 hover:border-sky-300 hover:bg-sky-50/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-700 dark:hover:bg-sky-950/30'
                  }
                `}
                  onClick={() => onSelectSite(site.id)}
                  onMouseEnter={() => handleMouseEnter(site.id)}
                >
                  <span className="line-clamp-2 text-sm font-bold leading-tight">
                    {getSiteDisplayName(site)}
                  </span>
                  <SiteMeta site={site} isActive={isActive} />
                  {isActive && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold text-white ring-1 ring-white/20">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Actif
                    </span>
                  )}
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
                className="min-w-0"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
