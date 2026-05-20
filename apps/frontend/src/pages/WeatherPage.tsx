import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import SiteSelector from '../components/dashboard/SiteSelector';
import CurrentConditions from '../components/weather/CurrentConditions';
import Forecast7Day from '../components/weather/Forecast7Day';
import HourlyForecast from '../components/weather/HourlyForecast';
import EmagramWidget from '../components/dashboard/EmagramWidget';
import WeatherMultiLanding from '../components/weather/WeatherMultiLanding';
import CityWeatherSearch, {
  type CityWeatherTarget,
} from '../components/weather/CityWeatherSearch';
import { BestSpotSuggestion } from '../components/weather/BestSpotSuggestion';
import {
  Button,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@dashboard-parapente/design-system';
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
import { CalendarDays, MapPin, Search, Wind } from 'lucide-react';
import {
  weatherCardClassName,
  weatherSectionTitleClassName,
} from '../components/weather/weatherUi';
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

type SelectionTab = 'favorites' | 'search';

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
  const [selectionTab, setSelectionTab] = useState<SelectionTab>(
    selectedSearchTarget ? 'search' : 'favorites'
  );
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
  const sourceLabel = selectedSearchTarget ? 'Recherche' : 'Site favori';

  const mobileSelectionPanel = (
    <div className="space-y-4">
      <section className={`${weatherCardClassName} overflow-visible`}>
        <div className="border-b border-slate-100 bg-gradient-to-br from-sky-50 via-white to-white p-4 dark:border-slate-800 dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className={weatherSectionTitleClassName}>Choix du site</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                Sélection météo
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                Gardez vos favoris sous la main ou cherchez une ville, un déco
                ou un atterro proche.
              </p>
            </div>
            {activeWeatherName && (
              <div className="min-w-0 rounded-2xl border border-sky-100 bg-white/80 px-3 py-2 text-sm shadow-sm dark:border-sky-900/60 dark:bg-slate-950/50">
                <span className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Actuel
                </span>
                <span className="block truncate font-bold text-sky-800 dark:text-sky-200">
                  {activeWeatherName}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <Tabs
            selectedKey={selectionTab}
            onSelectionChange={(key) => {
              const nextTab = key as SelectionTab;
              setSelectionTab(nextTab);
              if (nextTab === 'favorites') {
                void navigate({
                  to: '/weather',
                  search: {
                    siteId: selectedSiteId || undefined,
                    day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
                  },
                });
              }
            }}
          >
            <TabList className="grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 shadow-none dark:bg-slate-950/70">
              <Tab id="favorites">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Favoris
                </span>
              </Tab>
              <Tab id="search">
                <span className="inline-flex items-center gap-2">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Recherche
                </span>
              </Tab>
            </TabList>
            <TabPanel id="favorites">
              {sites.length > 0 ? (
                <SiteSelector
                  selectedSiteId={selectedSearchTarget ? '' : selectedSiteId}
                  onSelectSite={(siteId) => {
                    setSelectionTab('favorites');
                    void navigate({
                      to: '/weather',
                      search: {
                        siteId,
                        day:
                          selectedDayIndex > 0 ? selectedDayIndex : undefined,
                      },
                    });
                  }}
                  weatherData={weatherDataMap}
                />
              ) : (
                <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {t('dashboard.noSites')}
                  </p>
                  <p className="mt-1">{t('dashboard.noSitesDescription')}</p>
                  <Button
                    onPress={() => void navigate({ to: '/sites' })}
                    className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    {t('dashboard.addSite')}
                  </Button>
                </div>
              )}
            </TabPanel>
            <TabPanel id="search">
              <CityWeatherSearch
                dayIndex={selectedDayIndex}
                selectedTarget={selectedSearchTarget}
                favoriteSites={sites}
                isEmbedded
                onSelectTarget={(target) => {
                  setSelectionTab('search');
                  void navigate({
                    to: '/weather',
                    search: {
                      ...getSearchForTarget(target, selectedDayIndex),
                    },
                  });
                }}
                onFavoriteCreated={(siteId) => {
                  setSelectionTab('favorites');
                  void navigate({
                    to: '/weather',
                    search: {
                      siteId,
                      day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
                    },
                  });
                }}
              />
            </TabPanel>
          </Tabs>
        </div>
      </section>

      <BestSpotSuggestion
        bestSpot={bestSpot ?? null}
        hourlyBestSpots={hourlyBestSpots?.hours ?? []}
        hourlyStartHour={hourlyBestSpots?.startHour}
        onSelectSite={(siteId) => {
          setSelectionTab('favorites');
          void navigate({
            to: '/weather',
            search: {
              siteId,
              day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
            },
          });
        }}
        selectedDayIndex={selectedDayIndex}
      />
    </div>
  );

  const mobileEmptyPanel =
    !selectedSearchTarget && !selectedSiteId ? (
      <section className={`${weatherCardClassName} p-6 text-center`}>
        <h2 className="text-xl font-bold text-gray-950 dark:text-white">
          Choisissez une météo
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Ajoutez un site favori ou recherchez une ville pour afficher le détail
          heure par heure.
        </p>
      </section>
    ) : undefined;

  const mobileSearchResultPanel = selectedSearchTarget ? (
    <section className={`${weatherCardClassName} p-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Résultat de recherche sélectionné
          </p>
          <h2 className="text-xl font-bold text-gray-950 dark:text-white">
            {selectedSearchTitle}
          </h2>
        </div>
        <div
          aria-label={t('weather.forecast7Days')}
          className="flex flex-wrap gap-2"
          role="tablist"
        >
          {Array.from({ length: 7 }, (_, day) => (
            <button
              key={day}
              aria-selected={day === selectedDayIndex}
              type="button"
              onClick={() =>
                void navigate({
                  to: '/weather',
                  search: {
                    ...getSearchForTarget(selectedSearchTarget, day),
                  },
                })
              }
              role="tab"
              className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                day === selectedDayIndex
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {getSearchDayLabel(day, t)}
            </button>
          ))}
        </div>
      </div>
    </section>
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
      <section
        className={`${weatherCardClassName} border-l-4 border-l-cyan-500 p-4 sm:p-5`}
      >
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
            className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
          >
            {t('weather.liveWindOpenSpotair')}
          </a>
        </div>
      </section>
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
    ) : undefined;

  const mobileEmagramPanel =
    isAuthenticated && !selectedSearchTarget && selectedSiteId ? (
      <EmagramWidget siteId={selectedSiteId} dayIndex={selectedDayIndex} />
    ) : undefined;

  const mobileHourlyPanel =
    selectedSearchTarget || selectedSiteId ? (
      <HourlyForecast
        spotId={selectedSearchTarget ? undefined : selectedSiteId}
        dayIndex={selectedDayIndex}
        weatherData={selectedSearchWeatherData}
        isLoading={selectedSearchTarget ? isSearchWeatherLoading : undefined}
        isError={selectedSearchTarget ? isSearchWeatherError : undefined}
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
        selectionPanel={mobileSelectionPanel}
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
        <section className={`${weatherCardClassName} overflow-visible`}>
          <div className="border-b border-slate-100 bg-gradient-to-br from-sky-50 via-white to-white p-4 dark:border-slate-800 dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className={weatherSectionTitleClassName}>Choix du site</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                  Sélection météo
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                  Gardez vos favoris sous la main ou cherchez une ville, un déco
                  ou un atterro proche.
                </p>
              </div>
              {activeWeatherName && (
                <div className="min-w-0 rounded-2xl border border-sky-100 bg-white/80 px-3 py-2 text-sm shadow-sm dark:border-sky-900/60 dark:bg-slate-950/50">
                  <span className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Actuel
                  </span>
                  <span className="block truncate font-bold text-sky-800 dark:text-sky-200">
                    {activeWeatherName}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="p-3 sm:p-4">
            <Tabs
              selectedKey={selectionTab}
              onSelectionChange={(key) => {
                const nextTab = key as SelectionTab;
                setSelectionTab(nextTab);
                if (nextTab === 'favorites') {
                  void navigate({
                    to: '/weather',
                    search: {
                      siteId: selectedSiteId || undefined,
                      day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
                    },
                  });
                }
              }}
            >
              <TabList className="grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 shadow-none dark:bg-slate-950/70">
                <Tab id="favorites">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    Favoris
                  </span>
                </Tab>
                <Tab id="search">
                  <span className="inline-flex items-center gap-2">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Recherche
                  </span>
                </Tab>
              </TabList>
              <TabPanel id="favorites">
                {sites.length > 0 ? (
                  <SiteSelector
                    selectedSiteId={selectedSearchTarget ? '' : selectedSiteId}
                    onSelectSite={(siteId) => {
                      setSelectionTab('favorites');
                      void navigate({
                        to: '/weather',
                        search: {
                          siteId,
                          day:
                            selectedDayIndex > 0 ? selectedDayIndex : undefined,
                        },
                      });
                    }}
                    weatherData={weatherDataMap}
                  />
                ) : (
                  <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {t('dashboard.noSites')}
                    </p>
                    <p className="mt-1">{t('dashboard.noSitesDescription')}</p>
                    <Button
                      onPress={() => void navigate({ to: '/sites' })}
                      className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                    >
                      {t('dashboard.addSite')}
                    </Button>
                  </div>
                )}
              </TabPanel>
              <TabPanel id="search">
                <CityWeatherSearch
                  dayIndex={selectedDayIndex}
                  selectedTarget={selectedSearchTarget}
                  favoriteSites={sites}
                  isEmbedded
                  onSelectTarget={(target) => {
                    setSelectionTab('search');
                    void navigate({
                      to: '/weather',
                      search: getSearchForTarget(target, selectedDayIndex),
                    });
                  }}
                  onFavoriteCreated={(siteId) => {
                    setSelectionTab('favorites');
                    void navigate({
                      to: '/weather',
                      search: {
                        siteId,
                        day:
                          selectedDayIndex > 0 ? selectedDayIndex : undefined,
                      },
                    });
                  }}
                />
              </TabPanel>
            </Tabs>
          </div>
        </section>

        <BestSpotSuggestion
          bestSpot={bestSpot ?? null}
          hourlyBestSpots={hourlyBestSpots?.hours ?? []}
          hourlyStartHour={hourlyBestSpots?.startHour}
          onSelectSite={(siteId) => {
            setSelectionTab('favorites');
            void navigate({
              to: '/weather',
              search: {
                siteId,
                day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
              },
            });
          }}
          selectedDayIndex={selectedDayIndex}
        />
      </aside>

      <div className="min-w-0 space-y-4">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-700 via-blue-700 to-slate-950 p-4 text-white shadow-xl shadow-sky-900/20 dark:border-slate-700 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
                <Wind className="h-3.5 w-3.5" aria-hidden="true" />
                Météo de vol
              </div>
              <h1 className="mt-3 truncate text-2xl font-black tracking-tight sm:text-3xl">
                {activeWeatherName ?? 'Prévisions météo'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-sky-100 sm:text-base">
                Vue consolidée des conditions, du meilleur créneau et des
                risques météo pour préparer le vol.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-100">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  Jour
                </span>
                <strong className="mt-1 block text-sm">
                  {selectedDayLabel}
                </strong>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-100">
                  {selectedSearchTarget ? (
                    <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Source
                </span>
                <strong className="mt-1 block truncate text-sm">
                  {selectedSearchTarget ? 'Recherche' : 'Site favori'}
                </strong>
              </div>
            </div>
          </div>
        </section>

        {!selectedSearchTarget && !selectedSiteId && (
          <section className={`${weatherCardClassName} p-6 text-center`}>
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">
              Choisissez une météo
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Ajoutez un site favori ou recherchez une ville pour afficher le
              détail heure par heure.
            </p>
          </section>
        )}

        {selectedSearchTarget && (
          <section className={`${weatherCardClassName} p-4`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  Résultat de recherche sélectionné
                </p>
                <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                  {selectedSearchTitle}
                </h2>
              </div>
              <div
                aria-label={t('weather.forecast7Days')}
                className="flex flex-wrap gap-2"
                role="tablist"
              >
                {Array.from({ length: 7 }, (_, day) => (
                  <button
                    key={day}
                    aria-selected={day === selectedDayIndex}
                    type="button"
                    onClick={() =>
                      void navigate({
                        to: '/weather',
                        search: getSearchForTarget(selectedSearchTarget, day),
                      })
                    }
                    role="tab"
                    className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      day === selectedDayIndex
                        ? 'bg-sky-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {getSearchDayLabel(day, t)}
                  </button>
                ))}
              </div>
            </div>
          </section>
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

        {!selectedSearchTarget && selectedSiteId && (
          <section
            className={`${weatherCardClassName} border-l-4 border-l-cyan-500 p-4 sm:p-5`}
          >
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
                className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
              >
                {t('weather.liveWindOpenSpotair')}
              </a>
            </div>
          </section>
        )}

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
        )}

        {/* Emagram Analysis (authenticated only) */}
        {isAuthenticated && !selectedSearchTarget && selectedSiteId && (
          <EmagramWidget siteId={selectedSiteId} dayIndex={selectedDayIndex} />
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
          />
        )}
      </div>
    </div>
  );
}
