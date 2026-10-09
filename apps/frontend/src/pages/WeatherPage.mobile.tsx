import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import WeatherPageHero from '../components/weather/WeatherPageHero';
import { weatherCardClassName } from '../components/weather/weatherUi';

type WeatherPageMobileProps = {
  activeWeatherName?: string;
  selectedDayLabel: string;
  sourceLabel: string;
  isSearchMode: boolean;
  stickySelectionBar: ReactNode;
  bestSpotSuggestion: ReactNode;
  forceRefreshControl?: ReactNode;
  spotairAnalysisLink?: ReactNode;
  decisionPanel?: ReactNode;
  searchResultPanel?: ReactNode;
  emptyPanel?: ReactNode;
  currentConditions?: ReactNode;
  airspacePanel?: ReactNode;
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
  isSearchMode,
  stickySelectionBar,
  bestSpotSuggestion,
  forceRefreshControl,
  spotairAnalysisLink,
  decisionPanel,
  searchResultPanel,
  emptyPanel,
  currentConditions,
  airspacePanel,
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

      {forceRefreshControl}
      {spotairAnalysisLink}

      {emptyPanel}
      {decisionPanel}
      {currentConditions}
      {searchResultPanel}
      {airspacePanel}
      {forecastPanel}
      <ExpandableSection
        title={t('weather.liveWindTitle')}
        summary={t('weather.mobile.liveWindSummary')}
      >
        {liveWindPanel}
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
      <ExpandableSection
        title={t('weather.page.otherSitesTitle')}
        summary={t('weather.page.otherSitesSummary')}
      >
        {bestSpotSuggestion}
      </ExpandableSection>
    </div>
  );
}
