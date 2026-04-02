/**
 * MultiOrientationSelector Component
 *
 * Generic dropdown selector for sites with multiple orientations/takeoffs
 * Automatically groups sites by their base name and shows them in a dropdown
 *
 * Example: "Mont Poupet Nord", "Mont Poupet Sud" -> Grouped as "Mont Poupet"
 */

import { useState, useRef, useEffect } from 'react';
import type { Site } from '../../types';
import { WindIndicatorCompact } from '../common/WindIndicator';

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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find currently selected site
  const selectedSite = sites.find((site) => site.id === selectedSiteId);

  // Determine display name (use baseName prop or extract from first site)
  const displayName = baseName || extractBaseName(sites[0]?.name || '');

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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-full p-3 sm:p-2.5 rounded-lg font-medium transition-all ${
          selectedSite
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
        }`}
      >
        <div className="flex items-center gap-2 justify-center">
          <span>{displayName}</span>
          {selectedSite && selectedSite.orientation && (
            <span className="text-sm opacity-90">
              ({selectedSite.orientation})
            </span>
          )}
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">
              Choisir un décollage
            </div>

            {sortedSites.map((site) => {
              const weather = weatherData.get(site.id);
              const isSelected = site.id === selectedSiteId;
              const shortName = extractShortName(site.name, displayName);

              return (
                <button
                  key={site.id}
                  onClick={() => handleSelect(site.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">{shortName}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {site.orientation || 'N/A'}
                      {site.elevation_m && ` • ${site.elevation_m}m`}
                      {site.rating && ` • ${'⭐'.repeat(site.rating)}`}
                    </span>
                    {weather?.paraIndex !== undefined && (
                      <span className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Para-Index: {weather.paraIndex}
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
                </button>
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
    const regex = new RegExp(`\\s*${orientation}\\s*$`, 'i');
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
