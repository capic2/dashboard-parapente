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
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from '@tanstack/react-router';

export default function WeatherPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const search = useSearch({ from: '/weather' });
  const routeSiteId = search ? search.siteId : '';
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedSiteId =
    sites.find((site) => site.id === routeSiteId)?.id ?? sites[0]?.id ?? '';

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [weatherDataMap] = useState<Map<string, Record<string, unknown>>>(
    new Map()
  );

  if (sites.length === 0) {
    return (
      <div className="py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center max-w-md mx-auto">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            {t('dashboard.noSites', 'Aucun site configuré')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {t(
              'dashboard.noSitesDescription',
              'Ajoutez votre premier site de vol pour commencer.'
            )}
          </p>
          <button
            onClick={() => void navigate({ to: '/sites' })}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-all"
          >
            {t('dashboard.addSite', 'Ajouter un site')}
          </button>
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
            void navigate({ to: '/weather', search: { siteId } })
          }
          weatherData={weatherDataMap}
        />

        {/* Current Conditions */}
        <CurrentConditions spotId={selectedSiteId} />

        {/* Landing Sites Weather */}
        <WeatherMultiLanding
          spotId={selectedSiteId}
          dayIndex={selectedDayIndex}
        />

        {/* 7-Day Forecast + Day Selector */}
        <Forecast7Day
          spotId={selectedSiteId}
          selectedDayIndex={selectedDayIndex}
          onSelectDay={setSelectedDayIndex}
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
