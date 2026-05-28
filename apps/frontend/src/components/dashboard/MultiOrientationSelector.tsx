/**
 * MultiOrientationSelector Component
 *
 * Generic dropdown selector for sites with multiple orientations/takeoffs
 * Automatically groups sites by their base name and shows them in a dropdown
 *
 * Example: "Mont Poupet Nord", "Mont Poupet Sud" -> Grouped as "Mont Poupet"
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Site } from '../../types';
import { WindIndicatorCompact } from '../common/WindIndicator';
import { Button } from '@dashboard-parapente/design-system';
import { Check, ChevronDown, Layers, MapPin, Mountain } from 'lucide-react';
import { getSiteDisplayName } from '../../lib/siteDisplay';

interface MultiOrientationSelectorProps {
  sites: Site[]; // All variants of this site (different orientations)
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  weatherData?: Map<
    string,
    { windDirection?: string; windSpeed?: number; paraIndex?: number }
  >;
  className?: string;
  baseName?: string; // Display name (e.g., "Mont Poupet")
}

export function MultiOrientationSelector({
  sites,
  selectedSiteId,
  onSelectSite,
  weatherData = new Map(),
  className = '',
  baseName,
}: MultiOrientationSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find currently selected site
  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const hasSelectedSite = Boolean(selectedSite);

  // Determine display name (use baseName prop or extract from first site)
  const rawDisplayName = baseName || extractBaseName(sites[0]?.name || '');
  const displayName = getSiteDisplayName({
    name: rawDisplayName,
    region: sites[0]?.region,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle site selection
  const handleSelect = (siteId: string) => {
    onSelectSite(siteId);
    setIsOpen(false);
  };

  // Sort sites by orientation (N, NE, E, SE, S, SW, W, NW, then alphabetically for others)
  const sortedSites = [...sites].sort((a, b) => {
    const orientationOrder = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const aIndex = orientationOrder.indexOf(a.orientation || '');
    const bIndex = orientationOrder.indexOf(b.orientation || '');

    // If both have standard orientations, sort by orientation
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }

    // If only one has standard orientation, prioritize it
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    // Otherwise sort alphabetically by name
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Main button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-full w-full cursor-pointer flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
          hasSelectedSite
            ? 'border-sky-500 bg-gradient-to-br from-sky-600 to-sky-800 text-white shadow-md shadow-sky-900/20'
            : 'border-slate-200 bg-white text-slate-900 hover:border-sky-300 hover:bg-sky-50/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-700 dark:hover:bg-sky-950/30'
        }`}
      >
        <div className="flex w-full items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="line-clamp-2 text-sm font-bold leading-tight">
              {displayName}
            </span>
            <span
              className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${
                hasSelectedSite
                  ? 'text-sky-100'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3" aria-hidden="true" />
                {sites.length} orientations
              </span>
              {selectedSite?.elevation_m && (
                <span className="inline-flex items-center gap-1">
                  <Mountain className="h-3 w-3" aria-hidden="true" />
                  {selectedSite.elevation_m}m
                </span>
              )}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </div>
        {hasSelectedSite && (
          <div className="flex w-full items-center justify-between gap-2">
            {selectedSite?.orientation && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold ring-1 ring-white/20">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {selectedSite.orientation}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold ring-1 ring-white/20">
              <Check className="h-3 w-3" aria-hidden="true" />
              Actif
            </span>
          </div>
        )}
      </Button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[240px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
          <div className="p-2">
            <div className="mb-1 px-2 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Choisir un décollage
            </div>

            {sortedSites.map((site) => {
              const weather = weatherData.get(site.id);
              const isSelected = site.id === selectedSiteId;
              const shortName = extractShortName(site.name, rawDisplayName);

              return (
                <Button
                  key={site.id}
                  onClick={() => handleSelect(site.id)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50 text-sky-900 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-100'
                      : 'border-transparent text-slate-900 hover:border-sky-200 hover:bg-sky-50/70 dark:text-slate-100 dark:hover:border-sky-800 dark:hover:bg-sky-950/30'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold">{shortName}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{site.orientation || 'N/A'}</span>
                      {site.elevation_m && <span>{site.elevation_m}m</span>}
                      {site.rating && <span>Note {site.rating}/5</span>}
                    </span>
                    {weather?.paraIndex !== undefined && (
                      <span className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t('weather.paraIndex')}: {weather.paraIndex}
                      </span>
                    )}
                  </div>

                  {/* Wind indicator */}
                  {weather && (
                    <WindIndicatorCompact
                      windDirection={weather.windDirection}
                      siteOrientation={site.orientation || undefined}
                      windSpeed={weather.windSpeed}
                    />
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Extract base name from site name (e.g., "Mont Poupet Nord" -> "Mont Poupet")
 */
function extractBaseName(siteName: string): string {
  // Remove common orientation suffixes
  const orientations = [
    'Nord',
    'Sud',
    'Est',
    'Ouest',
    'Nord-Ouest',
    'Nord-Est',
    'Sud-Ouest',
    'Sud-Est',
    'N',
    'S',
    'E',
    'W',
    'NW',
    'NE',
    'SW',
    'SE',
  ];
  let baseName = siteName.trim();

  for (const orientation of orientations) {
    // Try to remove orientation from end of name
    const regex = new RegExp(`\\s*${orientation}\\s*$`, 'iu');
    baseName = baseName.replace(regex, '');
  }

  return baseName.trim();
}

/**
 * Extract short name for dropdown (e.g., "Mont Poupet Nord" with base "Mont Poupet" -> "Nord")
 */
function extractShortName(siteName: string, baseName: string): string {
  // Remove base name to get just the orientation/variant
  const shortName = siteName.replace(baseName, '').trim();
  return shortName || siteName;
}
