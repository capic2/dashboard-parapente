import { useState, useEffect, useRef } from 'react';
import SiteSelector from '../components/SiteSelector';
import CurrentConditions from '../components/weather/CurrentConditions';
import Forecast7Day from '../components/weather/Forecast7Day';
import HourlyForecast from '../components/weather/HourlyForecast';
import StatsPanel from '../components/StatsPanel';
import EmagramWidget from '../components/complex/EmagramWidget';
import { BestSpotSuggestion } from '../components/weather/BestSpotSuggestion';
import { useSites } from '../hooks/useSites';
import { useSite } from '../hooks/useSites';
import { useBestSpotAPI } from '../hooks/useBestSpotAPI';

export default function Dashboard() {
  const { data: sites, isLoading: sitesLoading, error } = useSites();
  const { bestSpot, loading: bestSpotLoading, error: bestSpotError } = useBestSpotAPI();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [weatherDataMap] = useState<Map<string, any>>(new Map()); // Pas utilisé mais gardé pour SiteSelector
  const hourlyForecastRef = useRef<HTMLDivElement>(null);
  
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

  // Handler for day selection with smooth scroll
  const handleSelectDay = (dayIndex: number) => {
    setSelectedDayIndex(dayIndex);
    // Scroll to hourly forecast
    setTimeout(() => {
      hourlyForecastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
      {/* Best Spot Suggestion - Loaded from backend API (cached) */}
      {!bestSpotLoading && !bestSpotError && bestSpot && (
        <BestSpotSuggestion 
          bestSpot={bestSpot}
          onSelectSite={setSelectedSiteId}
          className="mb-4"
        />
      )}
      
      <SiteSelector 
        selectedSiteId={selectedSiteId}
        onSelectSite={setSelectedSiteId}
        weatherData={weatherDataMap}
      />

      <div className="space-y-4">
        {/* Row 1: Current Conditions + Emagram Widget (1/3 - 2/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <CurrentConditions spotId={selectedSiteId} />
          </div>
          <div className="lg:col-span-2">
            <EmagramWidget userLat={userLat} userLon={userLon} />
          </div>
        </div>

        {/* Row 2: Stats Panel (full width) */}
        <StatsPanel />

        {/* Row 3: 7-Day Forecast (full width) */}
        <Forecast7Day 
          spotId={selectedSiteId}
          selectedDayIndex={selectedDayIndex}
          onSelectDay={handleSelectDay}
        />

        {/* Row 4: Hourly Forecast (full width) */}
        <div ref={hourlyForecastRef}>
          <HourlyForecast spotId={selectedSiteId} dayIndex={selectedDayIndex} />
        </div>
      </div>
    </div>
  );
}
