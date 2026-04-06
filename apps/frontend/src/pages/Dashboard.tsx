import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import StatsPanel from '../components/dashboard/StatsPanel';
import DaySelector from '../components/dashboard/DaySelector';
import AllSitesConditions from '../components/dashboard/AllSitesConditions';
import { BestSpotSuggestion } from '../components/weather/BestSpotSuggestion';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { useBestSpotAPI } from '../hooks/weather/useBestSpotAPI';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const { data: bestSpot } = useBestSpotAPI(selectedDayIndex);

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
        {/* 1. Stats Panel */}
        <StatsPanel />

        {/* 2. Day Selector + Best Spot */}
        <DaySelector
          selectedDayIndex={selectedDayIndex}
          onSelectDay={setSelectedDayIndex}
        />

        <BestSpotSuggestion
          bestSpot={bestSpot ?? null}
          onSelectSite={(siteId) =>
            void navigate({ to: '/weather', search: { siteId } })
          }
          selectedDayIndex={selectedDayIndex}
        />

        {/* 3. Current Conditions - All Sites (auto-refresh hourly) */}
        <AllSitesConditions />
      </div>
    </div>
  );
}
