import { useTranslation } from 'react-i18next';
import { MapPin, Search } from 'lucide-react';
import {
  Button,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@dashboard-parapente/design-system';
import type {
  BestSpotResult,
  HourlyBestSpotsResult,
  Site,
} from '@dashboard-parapente/shared-types';
import SiteSelector from '../dashboard/SiteSelector';
import CityWeatherSearch, { type CityWeatherTarget } from './CityWeatherSearch';
import { BestSpotSuggestion } from './BestSpotSuggestion';
import {
  weatherCardClassName,
  weatherSectionTitleClassName,
} from './weatherUi';

export type WeatherSelectionTab = 'favorites' | 'search';

type WeatherSelectionPanelProps = {
  activeWeatherName?: string;
  selectionTab: WeatherSelectionTab;
  sites: Site[];
  selectedSearchTarget: CityWeatherTarget | null;
  selectedSiteId: string;
  selectedDayIndex: number;
  weatherData: Map<string, Record<string, unknown>>;
  bestSpot: BestSpotResult | null;
  hourlyBestSpots?: HourlyBestSpotsResult['hours'];
  hourlyStartHour?: number;
  onSelectionTabChange: (tab: WeatherSelectionTab) => void;
  onSelectSite: (siteId: string) => void;
  onSelectSearchTarget: (target: CityWeatherTarget | null) => void;
  onFavoriteCreated: (siteId: string) => void;
  onAddSite: () => void;
};

export default function WeatherSelectionPanel({
  activeWeatherName,
  selectionTab,
  sites,
  selectedSearchTarget,
  selectedSiteId,
  selectedDayIndex,
  weatherData,
  bestSpot,
  hourlyBestSpots = [],
  hourlyStartHour,
  onSelectionTabChange,
  onSelectSite,
  onSelectSearchTarget,
  onFavoriteCreated,
  onAddSite,
}: WeatherSelectionPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <section className={`${weatherCardClassName} overflow-visible`}>
        <div className="border-b border-slate-100 bg-gradient-to-br from-sky-50 via-white to-white p-4 dark:border-slate-800 dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className={weatherSectionTitleClassName}>
                {t('weather.selection.title')}
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                {t('weather.selection.heading')}
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                {t('weather.selection.description')}
              </p>
            </div>
            {activeWeatherName && (
              <div className="min-w-0 rounded-2xl border border-sky-100 bg-white/80 px-3 py-2 text-sm shadow-sm dark:border-sky-900/60 dark:bg-slate-950/50">
                <span className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {t('weather.selection.current')}
                </span>
                <span className="block truncate font-bold text-sky-800 dark:text-sky-200">
                  {activeWeatherName}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <Tabs
            selectedKey={selectionTab}
            onSelectionChange={(key) =>
              onSelectionTabChange(key as WeatherSelectionTab)
            }
          >
            <TabList className="grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 shadow-none dark:bg-slate-950/70">
              <Tab id="favorites">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {t('weather.selection.favorites')}
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
              {sites.length > 0 ? (
                <SiteSelector
                  selectedSiteId={selectedSearchTarget ? '' : selectedSiteId}
                  onSelectSite={onSelectSite}
                  weatherData={weatherData}
                />
              ) : (
                <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {t('dashboard.noSites')}
                  </p>
                  <p className="mt-1">{t('dashboard.noSitesDescription')}</p>
                  <Button
                    onPress={onAddSite}
                    className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    {t('dashboard.addSite')}
                  </Button>
                </div>
              )}
            </TabPanel>
            <TabPanel id="search">
              <CityWeatherSearch
                dayIndex={selectedDayIndex}
                selectedTarget={selectedSearchTarget}
                favoriteSites={sites}
                isEmbedded
                onSelectTarget={onSelectSearchTarget}
                onFavoriteCreated={onFavoriteCreated}
              />
            </TabPanel>
          </Tabs>
        </div>
      </section>

      <BestSpotSuggestion
        bestSpot={bestSpot}
        hourlyBestSpots={hourlyBestSpots}
        hourlyStartHour={hourlyStartHour}
        onSelectSite={onSelectSite}
        selectedDayIndex={selectedDayIndex}
      />
    </div>
  );
}
