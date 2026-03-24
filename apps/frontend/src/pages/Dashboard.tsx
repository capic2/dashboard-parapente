import { useState, useEffect } from 'react';
import SiteSelector from '../components/SiteSelector';
import CurrentConditions from '../components/weather/CurrentConditions';
import Forecast7Day from '../components/weather/Forecast7Day';
import HourlyForecast from '../components/weather/HourlyForecast';
import StatsPanel from '../components/StatsPanel';
import EmagramWidget from '../components/complex/EmagramWidget';
import { BestSpotSuggestion } from '../components/weather/BestSpotSuggestion';
import WeatherMultiLanding from '../components/weather/WeatherMultiLanding';
import { useSites } from '../hooks/useSites';
import { useSite } from '../hooks/useSites';
import { useBestSpotAPI } from '../hooks/useBestSpotAPI';

export default function Dashboard() {
  const { data: sites, isLoading: sitesLoading, error } = useSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const { data: bestSpot } = useBestSpotAPI(selectedDayIndex);
  const [weatherDataMap] = useState<Map<string, any>>(new Map()); // Pas utilisé mais gardé pour SiteSelector
  
  // Get selected site coordinates for emagram
  const { data: selectedSite } = useSite(selectedSiteId);
  const userLat = selectedSite?.latitude || null;
  const userLon = selectedSite?.longitude || null;

  // OPTIMISATION: Ne charge PAS les données pour tous les sites au démarrage
  // Seul le site sélectionné charge ses données (via CurrentConditions et HourlyForecast)
  // Cela évite 6 requêtes inutiles de ~50s chacune au chargement initial
  // Les autres sites seront préchargés au hover grâce au prefetch dans SiteSelector
  
  // Pas de fetchAllWeatherSummaries() - supprimé pour optimisation

  // OPTIMISATION: Pas de calcul de "best spot" au chargement (nécessiterait de charger tous les sites)
  // Auto-sélection du premier site uniquement
  useEffect(() => {
    if (sites && sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  // Handler for day selection (no scroll)
  const handleSelectDay = (dayIndex: number) => {
    setSelectedDayIndex(dayIndex);
  };

  // Show error state
  if (error) {
    return (
      <div className="py-8">
        <div className="bg-white rounded-xl p-8 shadow-md text-center max-w-md mx-auto">
          <h2 className="text-xl font-bold text-red-600 mb-3">❌ Erreur de chargement</h2>
          <p className="text-gray-700 mb-4">{error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-all"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (sitesLoading || !selectedSiteId) {
    return (
      <div className="py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center max-w-md mx-auto">
          <div className="text-gray-600 dark:text-gray-300 mb-3">Chargement du tableau de bord...</div>
          {sites && <p className="text-sm text-gray-500 dark:text-gray-400">Sites chargés: {sites.length}</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4">
        {/* 1. Stats Panel (full width) */}
        <StatsPanel />

        {/* 2. Site Selector (full width) */}
        <SiteSelector 
          selectedSiteId={selectedSiteId}
          onSelectSite={setSelectedSiteId}
          weatherData={weatherDataMap}
        />

        {/* 3. Current Conditions (full width) */}
        <CurrentConditions spotId={selectedSiteId} />

        {/* 3.5. Landing Sites Weather (if any) */}
        <WeatherMultiLanding spotId={selectedSiteId} dayIndex={selectedDayIndex} />

        {/* 4. Day Selector - 7-Day Forecast (full width) */}
        <Forecast7Day 
          spotId={selectedSiteId}
          selectedDayIndex={selectedDayIndex}
          onSelectDay={handleSelectDay}
        />

        {/* 5. Best Spot | Emagram (40% / 60%) */}
        <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4">
          <BestSpotSuggestion 
            bestSpot={bestSpot ?? null}
            onSelectSite={setSelectedSiteId}
            selectedDayIndex={selectedDayIndex}
          />
          <EmagramWidget userLat={userLat} userLon={userLon} />
        </div>

        {/* 6. Hourly Forecast (full width) */}
        <HourlyForecast spotId={selectedSiteId} dayIndex={selectedDayIndex} />
      </div>
    </div>
  );
}
