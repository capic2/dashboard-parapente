import React, { useState } from 'react';
import SiteSelector from '../components/SiteSelector';
import CurrentConditions from '../components/CurrentConditions';
import Forecast7Day from '../components/Forecast7Day';
import HourlyForecast from '../components/HourlyForecast';
import StatsPanel from '../components/StatsPanel';
import { useSites } from '../hooks/useSites';

export default function Dashboard() {
  const { data: sites, isLoading, error } = useSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // Auto-select first site when loaded
  React.useEffect(() => {
    if (sites && sites.length > 0 && !selectedSiteId) {
      console.log('✅ Auto-selecting first site:', sites[0]);
      // Use 'code' field for API calls, not 'id'
      setSelectedSiteId((sites[0] as any).code || sites[0].id);
    }
  }, [sites, selectedSiteId]);

  // Show error state
  if (error) {
    return (
      <div className="py-8">
        <div className="bg-white rounded-xl p-8 shadow-md text-center max-w-md mx-auto">
          <h2 className="text-xl font-bold text-red-600 mb-3">❌ Erreur de chargement</h2>
          <p className="text-gray-700 mb-4">{error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading || !selectedSiteId) {
    return (
      <div className="py-8">
        <div className="bg-white rounded-xl p-8 shadow-md text-center max-w-md mx-auto">
          <div className="text-gray-600 mb-3">Chargement du tableau de bord...</div>
          {sites && <p className="text-sm text-gray-500">Sites chargés: {sites.length}</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SiteSelector 
        selectedSiteId={selectedSiteId}
        onSelectSite={setSelectedSiteId}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Current Conditions - Full width on mobile, 1/3 on desktop */}
        <div className="lg:col-span-1">
          <CurrentConditions spotId={selectedSiteId} />
        </div>

        {/* Stats Panel - Full width on mobile, 2/3 on desktop */}
        <div className="lg:col-span-2">
          <StatsPanel />
        </div>

        {/* Hourly Forecast - Full width */}
        <div className="lg:col-span-3">
          <HourlyForecast spotId={selectedSiteId} />
        </div>

        {/* 7-Day Forecast - Full width */}
        <div className="lg:col-span-3">
          <Forecast7Day spotId={selectedSiteId} />
        </div>
      </div>
    </div>
  );
}
