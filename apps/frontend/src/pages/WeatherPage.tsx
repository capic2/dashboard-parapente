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
import { Button } from '@dashboard-parapente/design-system';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { useAuthStore } from '../stores/authStore';
import {
  useBestSpotAPI,
  useHourlyBestSpotsAPI,
} from '../hooks/weather/useBestSpotAPI';
import {
  useCoordinateWeather,
  useSpotWeather,
} from '../hooks/weather/useCityWeather';
import { transformWeatherResponse } from '../hooks/weather/useWeather';

const isSpotSearchTarget = (
  target: CityWeatherTarget | null
): target is Extract<CityWeatherTarget, { type: 'takeoff' | 'landing' }> =>
  target?.type === 'takeoff' || target?.type === 'landing';

const getSearchTargetName = (target: CityWeatherTarget | null) => {
  if (!target) return '';
  return target.type === 'city' ? target.location.name : target.spot.name;
};

const getSearchDayLabel = (
  day: number,
  t: (key: string) => string
) => {
  if (day === 0) return t('common.today');
  if (day === 1) return t('common.tomorrow');
  return `J+${day}`;
};

export default function WeatherPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const search = useSearch({ from: '/weather' });
  const routeSiteId = search ? search.siteId : '';
  const selectedDayIndex = search.day ?? 0;
  const { data: bestSpot } = useBestSpotAPI(selectedDayIndex);
  const { data: hourlyBestSpots } = useHourlyBestSpotsAPI(selectedDayIndex);
  const [selectedSearchTarget, setSelectedSearchTarget] =
    useState<CityWeatherTarget | null>(null);
  const selectedSiteId =
    sites.find((site) => site.id === routeSiteId)?.id ?? sites[0]?.id ?? '';
  const selectedSearchTitle = getSearchTargetName(selectedSearchTarget);
  const coordinateWeather = useCoordinateWeather(
    selectedSearchTarget?.type === 'city'
      ? selectedSearchTarget.location
      : null,
    selectedDayIndex
  );
  const spotWeather = useSpotWeather(
    isSpotSearchTarget(selectedSearchTarget)
      ? selectedSearchTarget.spot.id
      : null,
    selectedDayIndex
  );
  const selectedSearchWeather =
    selectedSearchTarget?.type === 'city'
      ? coordinateWeather.data
      : selectedSearchTarget
        ? spotWeather.data
        : undefined;
  const selectedSearchWeatherData = useMemo(
    () =>
      selectedSearchWeather
        ? transformWeatherResponse(selectedSearchWeather)
        : undefined,
    [selectedSearchWeather]
  );
  const isSearchWeatherLoading =
    selectedSearchTarget?.type === 'city'
      ? coordinateWeather.isLoading
      : selectedSearchTarget
        ? spotWeather.isLoading
        : false;
  const isSearchWeatherError =
    selectedSearchTarget?.type === 'city'
      ? coordinateWeather.isError
      : selectedSearchTarget
        ? spotWeather.isError
        : false;

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [weatherDataMap] = useState<Map<string, Record<string, unknown>>>(
    new Map()
  );
  const weatherSearch = {
    siteId: selectedSiteId,
    day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                Sites favoris
              </p>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                Sélection météo
              </h2>
            </div>
            {selectedSearchTarget && selectedSiteId && (
              <Button
                onPress={() => setSelectedSearchTarget(null)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
              >
                Revenir aux favoris
              </Button>
            )}
          </div>
          {sites.length > 0 ? (
            <SiteSelector
              selectedSiteId={selectedSearchTarget ? '' : selectedSiteId}
              onSelectSite={(siteId) => {
                setSelectedSearchTarget(null);
                void navigate({
                  to: '/weather',
                  search: {
                    siteId,
                    day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
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
                onClick={() => void navigate({ to: '/sites' })}
                className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                {t('dashboard.addSite')}
              </Button>
            </div>
          )}
        </section>

        <CityWeatherSearch
          dayIndex={selectedDayIndex}
          selectedTarget={selectedSearchTarget}
          favoriteSites={sites}
          onSelectTarget={setSelectedSearchTarget}
          onFavoriteCreated={(siteId) => {
            setSelectedSearchTarget(null);
            void navigate({
              to: '/weather',
              search: {
                siteId,
                day: selectedDayIndex > 0 ? selectedDayIndex : undefined,
              },
            });
          }}
        />

        <BestSpotSuggestion
          bestSpot={bestSpot ?? null}
          hourlyBestSpots={hourlyBestSpots?.hours ?? []}
          hourlyStartHour={hourlyBestSpots?.startHour}
          onSelectSite={(siteId) => {
            setSelectedSearchTarget(null);
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

      <div className="space-y-4 min-w-0">
        {!selectedSearchTarget && !selectedSiteId && (
          <section className="rounded-xl border border-sky-100 bg-white p-6 text-center shadow-md dark:border-gray-700 dark:bg-gray-800">
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
          <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800">
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
                    aria-pressed={day === selectedDayIndex}
                    aria-selected={day === selectedDayIndex}
                    type="button"
                    onClick={() =>
                      void navigate({
                        to: '/weather',
                        search: {
                          siteId: selectedSiteId || undefined,
                          day: day > 0 ? day : undefined,
                        },
                      })
                    }
                    role="tab"
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
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
