import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type {
  BestSpotResult,
  HourlyBestSpotsResult,
  Site,
} from '@dashboard-parapente/shared-types';
import CityWeatherSearch, { type CityWeatherTarget } from './CityWeatherSearch';
import { BestSpotSuggestion } from './BestSpotSuggestion';
import {
  weatherCardClassName,
  weatherSectionTitleClassName,
} from './weatherUi';

export type WeatherSelectionTab = 'favorites' | 'search';

type WeatherSelectionPanelProps = {
  sites: Site[];
  selectedSearchTarget: CityWeatherTarget | null;
  selectedDayIndex: number;
  bestSpot: BestSpotResult | null;
  hourlyBestSpots?: HourlyBestSpotsResult['hours'];
  hourlyStartHour?: number;
  onSelectSite: (siteId: string) => void;
  onSelectSearchTarget: (target: CityWeatherTarget | null) => void;
  onFavoriteCreated: (siteId: string) => void;
};

export default function WeatherSelectionPanel({
  sites,
  selectedSearchTarget,
  selectedDayIndex,
  bestSpot,
  hourlyBestSpots = [],
  hourlyStartHour,
  onSelectSite,
  onSelectSearchTarget,
  onFavoriteCreated,
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
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
            <Search className="h-4 w-4 text-sky-600" aria-hidden="true" />
            {t('weather.selection.search')}
          </div>
          <CityWeatherSearch
            dayIndex={selectedDayIndex}
            selectedTarget={selectedSearchTarget}
            favoriteSites={sites}
            isEmbedded
            onSelectTarget={onSelectSearchTarget}
            onFavoriteCreated={onFavoriteCreated}
          />
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
