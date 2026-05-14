import { useTranslation } from 'react-i18next';
import { useSuspenseQuery, useQueries } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CalendarDays, CloudSun, MapPinned, Video } from 'lucide-react';
import StatsPanel from '../components/dashboard/StatsPanel';
import AllSitesConditions from '../components/dashboard/AllSitesConditions';
import { BestSpotSuggestion } from '../components/weather/BestSpotSuggestion';
import { Button } from '@dashboard-parapente/design-system';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import {
  useBestSpotAPI,
  useHourlyBestSpotsAPI,
} from '../hooks/weather/useBestSpotAPI';
import { createWeatherQueryFn } from '../hooks/weather/useWeather';
import { getStaleTime, getWeatherRefetchInterval } from '../lib/cacheConfig';
import type { WeatherData } from '../types';
import type { SiteWeatherEntry } from '../components/dashboard/AllSitesConditions';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const { data: bestSpot } = useBestSpotAPI(0);
  const { data: hourlyBestSpots } = useHourlyBestSpotsAPI(0);
  const todayLabel = new Intl.DateTimeFormat(
    i18n.language.startsWith('en') ? 'en-US' : 'fr-FR',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }
  ).format(new Date());

  // Fetch current weather for all sites (day 0), auto-refresh every hour
  const weatherQueries = useQueries({
    queries: sites.map((site) => ({
      queryKey: ['weather', 'combined', site.id, 0] as const,
      queryFn: createWeatherQueryFn(site.id, 0),
      staleTime: getStaleTime(1000 * 60 * 30),
      refetchInterval: getWeatherRefetchInterval(1000 * 60 * 60),
      enabled: !!site.id,
    })),
  });

  // Build entries for AllSitesConditions
  const siteWeatherEntries: SiteWeatherEntry[] = sites.map((site, index) => ({
    site,
    weather: weatherQueries[index]?.data as WeatherData | undefined,
    isLoading: weatherQueries[index]?.isLoading ?? true,
    isError: weatherQueries[index]?.isError ?? false,
  }));

  if (sites.length === 0) {
    return (
      <div className="py-8">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-lg shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/20">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
            <MapPinned className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            {t('dashboard.noSites')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {t('dashboard.noSitesDescription')}
          </p>
          <Button
            onClick={() => void navigate({ to: '/sites' })}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-all"
          >
            {t('dashboard.addSite')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-blue-50 p-5 shadow-lg shadow-sky-100/70 dark:border-slate-700/80 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/50 dark:shadow-black/30 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 shadow-sm dark:border-sky-800/80 dark:bg-sky-950/50 dark:text-sky-300">
              <CloudSun className="h-4 w-4" aria-hidden="true" />
              {t('header.dashboard')}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {t('dashboard.homeTitle', 'Vue météo et vols du jour')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t(
                'dashboard.homeDescription',
                'Suivez rapidement les sites exploitables, les meilleurs créneaux et vos indicateurs de vol.'
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/85 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-200">
              <CalendarDays
                className="h-4 w-4 text-sky-600 dark:text-sky-400"
                aria-hidden="true"
              />
              <span className="capitalize">{todayLabel}</span>
            </div>
            <Button
              onPress={() => void navigate({ to: '/weather' })}
              className="rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-600/20 transition-colors hover:bg-sky-700"
            >
              {t('weather.viewForecast')}
            </Button>
            <Button
              onPress={() => void navigate({ to: '/gopro-overlay' })}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-slate-950/20 transition-colors hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              {t('header.goproOverlay')}
            </Button>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <StatsPanel />

        <BestSpotSuggestion
          bestSpot={bestSpot ?? null}
          hourlyBestSpots={hourlyBestSpots?.hours ?? []}
          hourlyStartHour={hourlyBestSpots?.startHour}
          onSelectSite={(siteId) =>
            void navigate({ to: '/weather', search: { siteId } })
          }
          selectedDayIndex={0}
        />

        <AllSitesConditions entries={siteWeatherEntries} />
      </div>
    </div>
  );
}
