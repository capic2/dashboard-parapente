import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react';
import {
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@dashboard-parapente/design-system';
import type { Site } from '@dashboard-parapente/shared-types';
import { getSiteDisplayName } from '../../lib/siteDisplay';
import CityWeatherSearch, { type CityWeatherTarget } from './CityWeatherSearch';

export type WeatherSelectionTab = 'favorites' | 'search';

type WeatherStickySelectionBarProps = {
  activeWeatherName?: string;
  selectedDayLabel: string;
  selectionTab: WeatherSelectionTab;
  allSites: Site[];
  sites: Site[];
  selectedSearchTarget: CityWeatherTarget | null;
  selectedSiteId: string;
  selectedDayIndex: number;
  onSelectionTabChange: (tab: WeatherSelectionTab) => void;
  onSelectSite: (siteId: string) => void;
  onSelectSearchTarget: (target: CityWeatherTarget | null) => void;
  onFavoriteCreated: (siteId: string) => void;
};

const getSearchText = (site: Site) =>
  [
    getSiteDisplayName(site),
    site.name,
    site.code,
    site.region,
    site.orientation,
    site.elevation_m?.toString(),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const getSiteMeta = (site: Site) =>
  [site.orientation, site.elevation_m ? `${site.elevation_m}m` : null]
    .filter(Boolean)
    .join(' · ');

export default function WeatherStickySelectionBar({
  activeWeatherName,
  selectedDayLabel,
  selectionTab,
  allSites,
  sites,
  selectedSearchTarget,
  selectedSiteId,
  selectedDayIndex,
  onSelectionTabChange,
  onSelectSite,
  onSelectSearchTarget,
  onFavoriteCreated,
}: WeatherStickySelectionBarProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [siteQuery, setSiteQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDialogElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const activeTab: WeatherSelectionTab =
    sites.length === 0 ? 'search' : selectionTab;
  const hasActiveTarget = Boolean(activeWeatherName);
  let targetKind = t('weather.sticky.target.none');
  if (selectedSearchTarget) {
    targetKind = t(`weather.sticky.target.${selectedSearchTarget.type}`);
  } else if (hasActiveTarget) {
    targetKind = t('weather.sticky.target.savedSite');
  }
  let contextLabel = t('weather.sticky.noContext');
  if (selectedSearchTarget) {
    contextLabel = t('flightDecision.context.title');
  } else if (hasActiveTarget) {
    contextLabel = t('flightDecision.title');
  }
  const filteredSites = useMemo(() => {
    const query = siteQuery.trim().toLowerCase();
    if (!query) return sites;

    return sites.filter((site) => getSearchText(site).includes(query));
  }, [siteQuery, sites]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement;
    const getFocusableElements = () =>
      Array.from(
        popoverRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => element.offsetParent !== null);

    window.requestAnimationFrame(() => {
      getFocusableElements()[0]?.focus();
    });

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        toggleButtonRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  const handleSelectSite = (siteId: string) => {
    onSelectSite(siteId);
    setSiteQuery('');
    setIsOpen(false);
  };

  const handleSelectSearchTarget = (target: CityWeatherTarget | null) => {
    onSelectSearchTarget(target);
    if (target) {
      setIsOpen(false);
    }
  };

  const handleFavoriteCreated = (siteId: string) => {
    onFavoriteCreated(siteId);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="sticky top-0 z-40 mb-4 rounded-2xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/70 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/30"
    >
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{targetKind}</span>
          </p>
          <h2 className="mt-0.5 truncate text-base font-black text-slate-950 dark:text-white sm:text-lg">
            {activeWeatherName ?? t('weather.sticky.noTarget')}
          </h2>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400 sm:text-sm">
            {contextLabel} · {selectedDayLabel}
          </p>
        </div>

        <button
          ref={toggleButtonRef}
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-bold text-white shadow-sm shadow-sky-900/20 transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 sm:px-4"
        >
          {hasActiveTarget
            ? t('weather.sticky.change')
            : t('weather.sticky.choose')}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {isOpen && (
        <dialog
          ref={popoverRef}
          open
          aria-labelledby="weather-selection-panel-title"
          aria-modal="true"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] w-auto max-w-none overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-3 text-left text-slate-950 shadow-2xl shadow-slate-900/20 backdrop:bg-transparent dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:shadow-black/50 sm:p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p
              id="weather-selection-panel-title"
              className="text-sm font-black text-slate-950 dark:text-white"
            >
              {t('weather.sticky.panelTitle')}
            </p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t('common.close')}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) =>
              onSelectionTabChange(key as WeatherSelectionTab)
            }
          >
            <TabList className="grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 shadow-none dark:bg-slate-950/70">
              <Tab id="favorites" isDisabled={sites.length === 0}>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {t('weather.sticky.savedSites')}
                </span>
              </Tab>
              <Tab id="search">
                <span className="inline-flex items-center gap-2">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {t('weather.selection.search')}
                </span>
              </Tab>
            </TabList>

            <TabPanel id="favorites">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t('weather.sticky.filterSites')}
                  <input
                    type="search"
                    value={siteQuery}
                    onChange={(event) => setSiteQuery(event.target.value)}
                    placeholder={t('weather.sticky.filterPlaceholder')}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>

                <div className="grid max-h-[42vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredSites.map((site) => {
                    const isActive =
                      site.id === selectedSiteId && !selectedSearchTarget;
                    const meta = getSiteMeta(site);

                    return (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() => handleSelectSite(site.id)}
                        className={`flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                          isActive
                            ? 'border-sky-500 bg-sky-600 text-white shadow-sm shadow-sky-900/20'
                            : 'border-slate-200 bg-white text-slate-900 hover:border-sky-300 hover:bg-sky-50/70 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-sky-700 dark:hover:bg-sky-950/30'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">
                            {getSiteDisplayName(site)}
                          </span>
                          {meta && (
                            <span
                              className={`mt-0.5 block truncate text-xs ${
                                isActive
                                  ? 'text-sky-100'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {meta}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <Check
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {filteredSites.length === 0 && (
                  <div className="rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    {t('weather.sticky.noSavedSiteFound')}
                  </div>
                )}
              </div>
            </TabPanel>

            <TabPanel id="search">
              <CityWeatherSearch
                dayIndex={selectedDayIndex}
                selectedTarget={selectedSearchTarget}
                favoriteSites={allSites}
                isEmbedded
                onSelectTarget={handleSelectSearchTarget}
                onFavoriteCreated={handleFavoriteCreated}
              />
            </TabPanel>
          </Tabs>
        </dialog>
      )}
    </div>
  );
}
