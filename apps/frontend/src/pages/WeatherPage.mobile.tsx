import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import WeatherPageHero from '../components/weather/WeatherPageHero';
import { weatherCardClassName } from '../components/weather/weatherUi';

type WeatherPageMobileProps = {
  activeWeatherName?: string;
  selectedDayLabel: string;
  sourceLabel: string;
  selectedSiteId?: string;
  isSearchMode: boolean;
  isAuthenticated: boolean;
  stickySelectionBar: ReactNode;
  bestSpotSuggestion: ReactNode;
  decisionPanel?: ReactNode;
  searchResultPanel?: ReactNode;
  emptyPanel?: ReactNode;
  currentConditions?: ReactNode;
  liveWindPanel?: ReactNode;
  landingPanel?: ReactNode;
  forecastPanel?: ReactNode;
  emagramPanel?: ReactNode;
  hourlyPanel?: ReactNode;
};

const ExpandableSection = ({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) => (
  <details
    className={`${weatherCardClassName} group overflow-hidden`}
    open={defaultOpen}
  >
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:hover:bg-slate-800/70">
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-950 dark:text-white">
          {title}
        </span>
        {summary && (
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {summary}
          </span>
        )}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-90"
        aria-hidden="true"
      />
    </summary>
    <div className="border-t border-slate-100 p-3 dark:border-slate-800">
      {children}
    </div>
  </details>
);

export default function WeatherPageMobileLayout({
  activeWeatherName,
  selectedDayLabel,
  sourceLabel,
  selectedSiteId,
  isSearchMode,
  isAuthenticated,
  stickySelectionBar,
  bestSpotSuggestion,
  decisionPanel,
  searchResultPanel,
  emptyPanel,
  currentConditions,
  liveWindPanel,
  landingPanel,
  forecastPanel,
  emagramPanel,
  hourlyPanel,
}: WeatherPageMobileProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 pb-24 sm:max-w-lg lg:max-w-xl">
      {stickySelectionBar}

      <WeatherPageHero
        activeWeatherName={activeWeatherName}
        selectedDayLabel={selectedDayLabel}
        sourceLabel={sourceLabel}
        isSearchMode={isSearchMode}
        variant="mobile"
      />

      {bestSpotSuggestion}

      {emptyPanel}
      {decisionPanel}
      {currentConditions}
      {searchResultPanel}
      <ExpandableSection
        title={t('weather.liveWindTitle')}
        summary={t('weather.mobile.liveWindSummary')}
      >
        {liveWindPanel}
      </ExpandableSection>
      <ExpandableSection
        title={t('weather.mobile.forecastTitle')}
        summary={t('weather.mobile.forecastSummary')}
      >
        {forecastPanel}
      </ExpandableSection>
      <ExpandableSection
        title={t('weather.mobile.hourlyTitle')}
        summary={t('weather.mobile.hourlySummary')}
        defaultOpen
      >
        {hourlyPanel}
      </ExpandableSection>
      <ExpandableSection
        title={t('weather.mobile.advancedTitle')}
        summary={t('weather.mobile.advancedSummary')}
      >
        <div className="space-y-3">
          {landingPanel}
          {emagramPanel}
        </div>
      </ExpandableSection>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
        <p className="font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          {t('weather.mobile.state')}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <dt className="font-semibold">{t('weather.mobile.mode')}</dt>
            <dd>
              {isSearchMode
                ? t('weather.source.search')
                : t('weather.source.favoriteSiteShort')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{t('weather.mobile.emagram')}</dt>
            <dd>
              {isAuthenticated
                ? t('weather.mobile.available')
                : t('weather.mobile.hidden')}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold">
              {t('weather.mobile.activeWeather')}
            </dt>
            <dd>{activeWeatherName ?? selectedSiteId ?? t('common.none')}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
