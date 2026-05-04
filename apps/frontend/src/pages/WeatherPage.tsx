import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import SiteSelector from '../components/dashboard/SiteSelector';
import CurrentConditions from '../components/weather/CurrentConditions';
import Forecast7Day from '../components/weather/Forecast7Day';
import HourlyForecast from '../components/weather/HourlyForecast';
import EmagramWidget from '../components/dashboard/EmagramWidget';
import WeatherMultiLanding from '../components/weather/WeatherMultiLanding';
import { BestSpotSuggestion } from '../components/weather/BestSpotSuggestion';
import { Button } from '@dashboard-parapente/design-system';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from '@tanstack/react-router';
import {
  useBestSpotAPI,
  useHourlyBestSpotsAPI,
} from '../hooks/weather/useBestSpotAPI';

export default function WeatherPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const search = useSearch({ from: '/weather' });
  const routeSiteId = search ? search.siteId : '';
  const selectedDayIndex = search.day ?? 0;
  const { data: bestSpot } = useBestSpotAPI(selectedDayIndex);
  const { data: hourlyBestSpots } = useHourlyBestSpotsAPI(selectedDayIndex);
  const selectedSiteId =
    sites.find((site) => site.id === routeSiteId)?.id ?? sites[0]?.id ?? '';

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [weatherDataMap] = useState<Map<string, Record<string, unknown>>>(
    new Map()
  );
  const weatherSearch = {
    siteId: selectedSiteId,
    day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
  };

  if (sites.length === 0) {
    return (
      <div className="py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center max-w-md mx-auto">
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
    <div>
      <div className="space-y-4">
        {/* Site Selector */}
        <SiteSelector
          selectedSiteId={selectedSiteId}
          onSelectSite={(siteId) =>
            void navigate({
              to: '/weather',
              search: {
                siteId,
                day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
              },
            })
          }
          weatherData={weatherDataMap}
        />

        {/* Best Spot for selected day */}
        <BestSpotSuggestion
          bestSpot={bestSpot ?? null}
          hourlyBestSpots={hourlyBestSpots?.hours ?? []}
          hourlyStartHour={hourlyBestSpots?.startHour}
          onSelectSite={(siteId) =>
            void navigate({
              to: '/weather',
              search: {
                siteId,
                day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
              },
            })
          }
          selectedDayIndex={selectedDayIndex}
        />

        {/* Current Conditions */}
        <CurrentConditions spotId={selectedSiteId} />

        {/* SpotAiR Live Wind (external link) */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('weather.liveWindTitle')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('weather.liveWindExternalInfo')}
              </p>
            </div>
            <a
              href="https://www.spotair.mobi/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
            >
              {t('weather.liveWindOpenSpotair')}
            </a>
          </div>
        </section>

        {/* Landing Sites Weather */}
        <WeatherMultiLanding
          spotId={selectedSiteId}
          dayIndex={selectedDayIndex}
        />

        {/* 7-Day Forecast + Day Selector */}
        <Forecast7Day
          spotId={selectedSiteId}
          selectedDayIndex={selectedDayIndex}
          onSelectDay={(day) =>
            void navigate({
              to: '/weather',
              search: {
                ...weatherSearch,
                day: day > 0 ? day : undefined,
              },
            })
          }
        />

        {/* Emagram Analysis (authenticated only) */}
        {isAuthenticated && (
          <EmagramWidget siteId={selectedSiteId} dayIndex={selectedDayIndex} />
        )}

        {/* Hourly Forecast */}
        <HourlyForecast spotId={selectedSiteId} dayIndex={selectedDayIndex} />
      </div>
    </div>
  );
}
