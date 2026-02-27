import React, { useState } from 'react';
import SiteSelector from '../components/SiteSelector';
import CurrentConditions from '../components/CurrentConditions';
import Forecast7Day from '../components/Forecast7Day';
import HourlyForecast from '../components/HourlyForecast';
import StatsPanel from '../components/StatsPanel';
import { useSites } from '../hooks/useSites';
import './Dashboard.css';

export default function Dashboard() {
  const { data: sites } = useSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // Auto-select first site when loaded
  React.useEffect(() => {
    if (sites && sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  if (!selectedSiteId) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="loading-spinner">Chargement du tableau de bord...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <SiteSelector 
        selectedSiteId={selectedSiteId}
        onSelectSite={setSelectedSiteId}
      />

      <div className="dashboard-grid">
        {/* Current Conditions - Full width on mobile, 1/3 on desktop */}
        <div className="grid-item current">
          <CurrentConditions spotId={selectedSiteId} />
        </div>

        {/* Stats Panel - Full width on mobile, 2/3 on desktop */}
        <div className="grid-item stats">
          <StatsPanel />
        </div>

        {/* Hourly Forecast - Full width */}
        <div className="grid-item hourly">
          <HourlyForecast spotId={selectedSiteId} />
        </div>

        {/* 7-Day Forecast - Full width */}
        <div className="grid-item forecast">
          <Forecast7Day spotId={selectedSiteId} />
        </div>
      </div>
    </div>
  );
}
