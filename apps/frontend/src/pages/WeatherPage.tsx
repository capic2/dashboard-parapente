import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import CurrentConditions from '../components/weather/CurrentConditions';
import Forecast7Day from '../components/weather/Forecast7Day';
import HourlyForecast from '../components/weather/HourlyForecast';
import EmagramWidget from '../components/dashboard/EmagramWidget';
import WeatherMultiLanding from '../components/weather/WeatherMultiLanding';
import { type CityWeatherTarget } from '../components/weather/CityWeatherSearch';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { useAuthStore } from '../stores/authStore';
import {
  useBestSpotAPI,
  useHourlyBestSpotsAPI,
} from '../hooks/weather/useBestSpotAPI';
import { useCoordinateWeather } from '../hooks/weather/useCityWeather';
import { transformWeatherResponse } from '../hooks/weather/useWeather';
import { useAppSettingsStore } from '../stores/appSettingsStore';
import { useIsMobile } from '../hooks/useIsMobile';
import WeatherEmptyState from '../components/weather/WeatherEmptyState';
import WeatherLiveWindPanel from '../components/weather/WeatherLiveWindPanel';
import WeatherPageHero from '../components/weather/WeatherPageHero';
import WeatherSearchResultPanel from '../components/weather/WeatherSearchResultPanel';
import WeatherSelectionPanel, {
  type WeatherSelectionTab,
} from '../components/weather/WeatherSelectionPanel';
import WeatherPageMobileLayout from './WeatherPage.mobile';

const isSpotSearchTarget = (
  target: CityWeatherTarget | null
): target is Extract<CityWeatherTarget, { type: 'takeoff' | 'landing' }> =>
  target?.type === 'takeoff' || target?.type === 'landing';

const getSearchTargetName = (target: CityWeatherTarget | null) => {
  if (!target) return '';
  return target.type === 'city' ? target.location.name : target.spot.name;
};

const getSearchTargetLocation = (target: CityWeatherTarget | null) => {
  if (!target) return null;
  if (target.type === 'city') return target.location;
  return target.spot;
};

const getSearchDayLabel = (day: number, t: (key: string) => string) => {
  if (day === 0) return t('common.today');
  if (day === 1) return t('common.tomorrow');
  return `J+${day}`;
};

type WeatherSearchParams = {
  siteId?: string;
  day?: number;
  target?: 'city' | 'takeoff' | 'landing';
  city?: string;
  displayName?: string;
  spotId?: string;
  spotName?: string;
  spotType?: 'takeoff' | 'landing' | 'both';
  lat?: number;
  lon?: number;
  elevation?: number;
  orientation?: string;
  country?: string;
  source?: string;
};

const hasCoordinates = (
  search: WeatherSearchParams
): search is WeatherSearchParams & { lat: number; lon: number } =>
  typeof search.lat === 'number' && typeof search.lon === 'number';

const getTargetFromSearch = (
  search: WeatherSearchParams
): CityWeatherTarget | null => {
  if (search.target === 'city' && search.city && hasCoordinates(search)) {
    return {
      type: 'city',
      location: {
        id: `query-city-${search.lat}-${search.lon}`,
        name: search.city,
        display_name: search.displayName ?? search.city,
        latitude: search.lat,
        longitude: search.lon,
        country: search.country ?? 'FR',
      },
    };
  }

  if (
    (search.target === 'takeoff' || search.target === 'landing') &&
    search.spotId &&
    search.spotName &&
    hasCoordinates(search)
  ) {
    return {
      type: search.target,
      spot: {
        id: search.spotId,
        name: search.spotName,
        type: search.spotType ?? search.target,
        latitude: search.lat,
        longitude: search.lon,
        elevation_m: search.elevation,
        orientation: search.orientation,
        rating: undefined,
        country: search.country ?? 'FR',
        source: search.source ?? 'query',
        distance_km: undefined,
      },
    };
  }

  return null;
};

const getSearchForTarget = (target: CityWeatherTarget | null, day: number) => {
  const daySearch = day > 0 ? day : undefined;

  if (!target) return { day: daySearch };

  if (target.type === 'city') {
    return {
      target: 'city' as const,
      city: target.location.name,
      displayName: target.location.display_name,
      lat: target.location.latitude,
      lon: target.location.longitude,
      country: target.location.country,
      day: daySearch,
    };
  }

  return {
    target: target.type,
    spotId: target.spot.id,
    spotName: target.spot.name,
    spotType: target.spot.type,
    lat: target.spot.latitude,
    lon: target.spot.longitude,
    elevation: target.spot.elevation_m ?? undefined,
    orientation: target.spot.orientation ?? undefined,
    country: target.spot.country,
    source: target.spot.source,
    day: daySearch,
  };
};

export default function WeatherPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const favoriteSiteIds = useAppSettingsStore(
    (state) => state.settings.favoriteSites
  );
  const isMobile = useIsMobile();
  const search = useSearch({ from: '/weather' });
  const routeSiteId = search ? search.siteId : '';
  const selectedDayIndex = search.day ?? 0;
  const selectedSearchTarget = getTargetFromSearch(search);
  const { data: bestSpot } = useBestSpotAPI(selectedDayIndex);
  const { data: hourlyBestSpots } = useHourlyBestSpotsAPI(selectedDayIndex);
  const routeSelectionTab: WeatherSelectionTab = selectedSearchTarget
    ? 'search'
    : 'favorites';
  const [selectionTab, setSelectionTab] =
    useState<WeatherSelectionTab>(routeSelectionTab);
  useEffect(() => {
    setSelectionTab(routeSelectionTab);
  }, [routeSelectionTab]);
  const favoriteSites = useMemo(() => {
    if (favoriteSiteIds.length === 0) return sites;

    const favoriteSet = new Set(favoriteSiteIds);
    const matchedFavorites = sites.filter((site) => favoriteSet.has(site.id));
    return matchedFavorites.length > 0 ? matchedFavorites : sites;
  }, [favoriteSiteIds, sites]);
  const routeSiteExists = sites.some((site) => site.id === routeSiteId);
  const selectedSiteId =
    (routeSiteExists ? routeSiteId : undefined) ??
    favoriteSites[0]?.id ??
    sites[0]?.id ??
    '';
  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const selectedSearchTitle = getSearchTargetName(selectedSearchTarget);
  const selectedSearchLocation = getSearchTargetLocation(selectedSearchTarget);
  const coordinateWeather = useCoordinateWeather(
    selectedSearchLocation,
    selectedDayIndex
  );
  const selectedSearchWeather = selectedSearchTarget
    ? coordinateWeather.data
    : undefined;
  const selectedSearchWeatherData = useMemo(
    () =>
      selectedSearchWeather
        ? transformWeatherResponse(selectedSearchWeather)
        : undefined,
    [selectedSearchWeather]
  );
  const isSearchWeatherLoading = selectedSearchTarget
    ? coordinateWeather.isLoading
    : false;
  const isSearchWeatherError = selectedSearchTarget
    ? coordinateWeather.isError
    : false;

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [weatherDataMap] = useState<Map<string, Record<string, unknown>>>(
    new Map()
  );
  const weatherSearch = {
    siteId: selectedSiteId,
    day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
  };
  const selectedDayLabel = getSearchDayLabel(selectedDayIndex, t);
  const activeWeatherName = selectedSearchTarget
    ? selectedSearchTitle
    : selectedSite?.name;
  const sourceLabel = selectedSearchTarget
    ? t('weather.source.search')
    : t('weather.source.favoriteSite');

  const handleSelectFavoriteTab = () => {
    setSelectionTab('favorites');
    void navigate({
      to: '/weather',
      search: {
        siteId: selectedSiteId || undefined,
        day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
      },
    });
  };

  const handleSelectionTabChange = (nextTab: WeatherSelectionTab) => {
    setSelectionTab(nextTab);
    if (nextTab === 'favorites') {
      handleSelectFavoriteTab();
    }
  };

  const handleSelectSite = (siteId: string) => {
    setSelectionTab('favorites');
    void navigate({
      to: '/weather',
      search: {
        siteId,
        day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
      },
    });
  };

  const handleSelectSearchTarget = (target: CityWeatherTarget | null) => {
    setSelectionTab('search');
    void navigate({
      to: '/weather',
      search: getSearchForTarget(target, selectedDayIndex),
    });
  };

  const handleSelectSearchDay = (day: number) => {
    void navigate({
      to: '/weather',
      search: getSearchForTarget(selectedSearchTarget, day),
    });
  };

  const handleSelectForecastDay = (day: number) => {
    void navigate({
      to: '/weather',
      search: {
        ...weatherSearch,
        day: day > 0 ? day : undefined,
      },
    });
  };

  const selectionPanel = (
    <WeatherSelectionPanel
      activeWeatherName={activeWeatherName}
      selectionTab={selectionTab}
      sites={sites}
      selectedSearchTarget={selectedSearchTarget}
      selectedSiteId={selectedSiteId}
      selectedDayIndex={selectedDayIndex}
      weatherData={weatherDataMap}
      bestSpot={bestSpot ?? null}
      hourlyBestSpots={hourlyBestSpots?.hours}
      hourlyStartHour={hourlyBestSpots?.startHour}
      onSelectionTabChange={handleSelectionTabChange}
      onSelectSite={handleSelectSite}
      onSelectSearchTarget={handleSelectSearchTarget}
      onFavoriteCreated={handleSelectSite}
      onAddSite={() => void navigate({ to: '/sites' })}
    />
  );

  const mobileEmptyPanel =
    !selectedSearchTarget && !selectedSiteId ? (
      <WeatherEmptyState />
    ) : undefined;

  const mobileSearchResultPanel = selectedSearchTarget ? (
    <WeatherSearchResultPanel
      selectedSearchTitle={selectedSearchTitle}
      selectedDayIndex={selectedDayIndex}
      getDayLabel={(day) => getSearchDayLabel(day, t)}
      onSelectDay={handleSelectSearchDay}
    />
  ) : undefined;

  const mobileCurrentConditions =
    selectedSearchTarget || selectedSiteId ? (
      <CurrentConditions
        spotId={selectedSearchTarget ? undefined : selectedSiteId}
        dayIndex={selectedDayIndex}
        weatherData={selectedSearchWeatherData}
        isLoading={selectedSearchTarget ? isSearchWeatherLoading : undefined}
        isError={selectedSearchTarget ? isSearchWeatherError : undefined}
        siteOrientation={
          isSpotSearchTarget(selectedSearchTarget)
            ? selectedSearchTarget.spot.orientation
            : undefined
        }
      />
    ) : undefined;

  const mobileLiveWindPanel =
    !selectedSearchTarget && selectedSiteId ? (
      <WeatherLiveWindPanel />
    ) : undefined;

  const mobileLandingPanel =
    !selectedSearchTarget && selectedSiteId ? (
      <WeatherMultiLanding
        spotId={selectedSiteId}
        dayIndex={selectedDayIndex}
      />
    ) : undefined;

  const mobileForecastPanel =
    !selectedSearchTarget && selectedSiteId ? (
      <Forecast7Day
        spotId={selectedSiteId}
        selectedDayIndex={selectedDayIndex}
        onSelectDay={handleSelectForecastDay}
      />
    ) : undefined;

  const mobileEmagramPanel =
    isAuthenticated && !selectedSearchTarget && selectedSiteId ? (
      <EmagramWidget
        siteId={selectedSiteId}
        dayIndex={selectedDayIndex}
        siteName={selectedSite?.name}
      />
    ) : undefined;

  const mobileHourlyPanel =
    selectedSearchTarget || selectedSiteId ? (
      <HourlyForecast
        spotId={selectedSearchTarget ? undefined : selectedSiteId}
        dayIndex={selectedDayIndex}
        weatherData={selectedSearchWeatherData}
        isLoading={selectedSearchTarget ? isSearchWeatherLoading : undefined}
        isError={selectedSearchTarget ? isSearchWeatherError : undefined}
        siteName={activeWeatherName}
      />
    ) : undefined;

  if (isMobile) {
    return (
      <WeatherPageMobileLayout
        activeWeatherName={activeWeatherName}
        selectedDayLabel={selectedDayLabel}
        sourceLabel={sourceLabel}
        selectedSiteId={selectedSiteId}
        isSearchMode={Boolean(selectedSearchTarget)}
        isAuthenticated={isAuthenticated}
        selectionPanel={selectionPanel}
        searchResultPanel={mobileSearchResultPanel}
        emptyPanel={mobileEmptyPanel}
        currentConditions={mobileCurrentConditions}
        liveWindPanel={mobileLiveWindPanel}
        landingPanel={mobileLandingPanel}
        forecastPanel={mobileForecastPanel}
        emagramPanel={mobileEmagramPanel}
        hourlyPanel={mobileHourlyPanel}
      />
    );
  }

  return (
    <div className="grid w-full min-w-0 gap-4 xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
        {selectionPanel}
      </aside>

      <div className="min-w-0 space-y-4">
        <WeatherPageHero
          activeWeatherName={activeWeatherName}
          selectedDayLabel={selectedDayLabel}
          sourceLabel={sourceLabel}
          isSearchMode={Boolean(selectedSearchTarget)}
        />

        {!selectedSearchTarget && !selectedSiteId && <WeatherEmptyState />}

        {selectedSearchTarget && (
          <WeatherSearchResultPanel
            selectedSearchTitle={selectedSearchTitle}
            selectedDayIndex={selectedDayIndex}
            getDayLabel={(day) => getSearchDayLabel(day, t)}
            onSelectDay={handleSelectSearchDay}
          />
        )}

        {(selectedSearchTarget || selectedSiteId) && (
          <CurrentConditions
            spotId={selectedSearchTarget ? undefined : selectedSiteId}
            dayIndex={selectedDayIndex}
            weatherData={selectedSearchWeatherData}
            isLoading={
              selectedSearchTarget ? isSearchWeatherLoading : undefined
            }
            isError={selectedSearchTarget ? isSearchWeatherError : undefined}
            siteOrientation={
              isSpotSearchTarget(selectedSearchTarget)
                ? selectedSearchTarget.spot.orientation
                : undefined
            }
          />
        )}

        {!selectedSearchTarget && selectedSiteId && <WeatherLiveWindPanel />}

        {/* Landing Sites Weather */}
        {!selectedSearchTarget && selectedSiteId && (
          <WeatherMultiLanding
            spotId={selectedSiteId}
            dayIndex={selectedDayIndex}
          />
        )}

        {/* 7-Day Forecast + Day Selector */}
        {!selectedSearchTarget && selectedSiteId && (
          <Forecast7Day
            spotId={selectedSiteId}
            selectedDayIndex={selectedDayIndex}
            onSelectDay={handleSelectForecastDay}
          />
        )}

        {/* Emagram Analysis (authenticated only) */}
        {isAuthenticated && !selectedSearchTarget && selectedSiteId && (
          <EmagramWidget
            siteId={selectedSiteId}
            dayIndex={selectedDayIndex}
            siteName={selectedSite?.name}
          />
        )}

        {/* Hourly Forecast */}
        {(selectedSearchTarget || selectedSiteId) && (
          <HourlyForecast
            spotId={selectedSearchTarget ? undefined : selectedSiteId}
            dayIndex={selectedDayIndex}
            weatherData={selectedSearchWeatherData}
            isLoading={
              selectedSearchTarget ? isSearchWeatherLoading : undefined
            }
            isError={selectedSearchTarget ? isSearchWeatherError : undefined}
            siteName={activeWeatherName}
          />
        )}
      </div>
    </div>
  );
}
