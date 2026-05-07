import { useEffect, useId, useState } from 'react';
import { Input, Label, TextField } from 'react-aria-components';
import { Button } from '@dashboard-parapente/design-system';
import type {
  BackendWeatherResponse,
  LocationSuggestion,
  ParaglidingSpotSearchResult,
  SpotWeatherResponse,
} from '@dashboard-parapente/shared-types';
import {
  useCoordinateWeather,
  useLocationSearch,
  useNearbyFlightOptions,
  useSpotWeather,
} from '../../hooks/weather/useCityWeather';
import { useCreateSite } from '../../hooks/sites/useSites';
import type { Site } from '../../types';

type SelectedOption =
  | { type: 'city'; location: LocationSuggestion }
  | { type: 'takeoff' | 'landing'; spot: ParaglidingSpotSearchResult };

export type CityWeatherTarget = SelectedOption;

interface CityWeatherSearchProps {
  dayIndex: number;
  selectedTarget: CityWeatherTarget | null;
  favoriteSites: Site[];
  onSelectTarget: (target: CityWeatherTarget | null) => void;
  onFavoriteCreated: (siteId: string) => void;
}

const radiusChoices = [10, 30, 50, 100];
const limitChoices = [3, 5, 10];

function WeatherSummaryCard({
  title,
  weather,
  isLoading,
}: {
  title: string;
  weather?: BackendWeatherResponse | SpotWeatherResponse;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
        Chargement météo pour {title}...
      </div>
    );
  }

  if (!weather) return null;

  const metrics = weather.metrics;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Météo sélectionnée
          </p>
          <h3 className="text-lg font-bold text-gray-950 dark:text-white">
            {title}
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {weather.slots_summary ||
              weather.explanation ||
              'Prévision disponible'}
          </p>
        </div>
        <div className="rounded-lg bg-white px-4 py-3 text-center shadow-sm dark:bg-gray-900">
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
            {weather.para_index ?? 0}
          </div>
          <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
            Para-index
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-white/80 p-3 dark:bg-gray-900/70">
          <div className="text-gray-500 dark:text-gray-400">Verdict</div>
          <div className="font-semibold text-gray-950 dark:text-white">
            {weather.verdict || 'N/A'}
          </div>
        </div>
        <div className="rounded-lg bg-white/80 p-3 dark:bg-gray-900/70">
          <div className="text-gray-500 dark:text-gray-400">Vent moy.</div>
          <div className="font-semibold text-gray-950 dark:text-white">
            {Math.round(metrics?.avg_wind_kmh ?? 0)} km/h
          </div>
        </div>
        <div className="rounded-lg bg-white/80 p-3 dark:bg-gray-900/70">
          <div className="text-gray-500 dark:text-gray-400">Rafales</div>
          <div className="font-semibold text-gray-950 dark:text-white">
            {Math.round(metrics?.max_gust_kmh ?? 0)} km/h
          </div>
        </div>
        <div className="rounded-lg bg-white/80 p-3 dark:bg-gray-900/70">
          <div className="text-gray-500 dark:text-gray-400">Pluie</div>
          <div className="font-semibold text-gray-950 dark:text-white">
            {(metrics?.total_rain_mm ?? 0).toFixed(1)} mm
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionButton({
  label,
  description,
  isSelected,
  onSelect,
}: {
  label: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`rounded-xl border p-3 text-left transition-all ${
        isSelected
          ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200 dark:border-sky-400 dark:bg-sky-950/40 dark:ring-sky-900'
          : 'border-gray-200 bg-white hover:border-sky-300 hover:bg-sky-50/60 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-sky-700 dark:hover:bg-sky-950/20'
      }`}
    >
      <div className="font-semibold text-gray-950 dark:text-white">{label}</div>
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {description}
      </div>
    </button>
  );
}

function spotDescription(spot: ParaglidingSpotSearchResult) {
  const parts = [`${spot.distance_km?.toFixed(1) ?? '?'} km`];
  if (spot.elevation_m) parts.push(`${spot.elevation_m} m`);
  if (spot.orientation) parts.push(`Orientation ${spot.orientation}`);
  return parts.join(' · ');
}

const isSpotOption = (
  option: SelectedOption | null
): option is Extract<SelectedOption, { type: 'takeoff' | 'landing' }> =>
  option?.type === 'takeoff' || option?.type === 'landing';

const getOptionName = (option: SelectedOption | null) => {
  if (!option) return '';
  return option.type === 'city' ? option.location.name : option.spot.name;
};

export default function CityWeatherSearch({
  dayIndex,
  selectedTarget,
  favoriteSites,
  onSelectTarget,
  onFavoriteCreated,
}: CityWeatherSearchProps) {
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSuggestion | null>(null);
  const [radiusKm, setRadiusKm] = useState(30);
  const [limit, setLimit] = useState(5);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<SelectedOption | null>(
    null
  );
  const createSite = useCreateSite();
  const [createdSpotIds, setCreatedSpotIds] = useState<Set<string>>(new Set());
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const locationSearch = useLocationSearch(debouncedQuery, 5);
  const nearbyOptions = useNearbyFlightOptions(
    selectedLocation,
    radiusKm,
    limit
  );
  const coordinateWeather = useCoordinateWeather(
    selectedOption?.type === 'city' ? selectedOption.location : null,
    dayIndex
  );
  const spotWeather = useSpotWeather(
    isSpotOption(selectedOption)
      ? selectedOption.spot.id
      : null,
    dayIndex
  );

  const weatherTitle = getOptionName(selectedOption);
  const activeTargetLabel = getOptionName(selectedTarget);
  const suggestions = locationSearch.data?.locations ?? [];
  const isSuggestionsOpen = debouncedQuery.length >= 3 && !selectedLocation;
  const activeSuggestion = suggestions[activeSuggestionIndex];
  const activeSuggestionId = activeSuggestion
    ? `${listboxId}-${activeSuggestion.id}`
    : undefined;
  let selectedWeather: BackendWeatherResponse | SpotWeatherResponse | undefined;
  let isWeatherLoading = false;
  let isWeatherError = false;
  if (selectedOption?.type === 'city') {
    selectedWeather = coordinateWeather.data;
    isWeatherLoading = coordinateWeather.isLoading;
    isWeatherError = coordinateWeather.isError;
  } else if (isSpotOption(selectedOption)) {
    selectedWeather = spotWeather.data;
    isWeatherLoading = spotWeather.isLoading;
    isWeatherError = spotWeather.isError;
  }

  const handleSelectLocation = (location: LocationSuggestion) => {
    const target: SelectedOption = { type: 'city', location };
    setSelectedLocation(location);
    setSelectedOption(target);
    onSelectTarget(target);
    setFavoriteError(null);
    setQuery(location.name);
    setActiveSuggestionIndex(0);
  };

  const handleSelectSpot = (
    type: 'takeoff' | 'landing',
    spot: ParaglidingSpotSearchResult
  ) => {
    const target: SelectedOption = { type, spot };
    setSelectedOption(target);
    onSelectTarget(target);
    setFavoriteError(null);
  };

  const selectedSpot = isSpotOption(selectedOption)
    ? selectedOption.spot
    : null;
  const selectedSpotUsageType = isSpotOption(selectedOption)
    ? selectedOption.type
    : 'both';
  const isSelectedSpotFavorite = selectedSpot
    ? favoriteSites.some(
        (site) =>
          site.name === selectedSpot.name ||
          (Math.abs(site.latitude - selectedSpot.latitude) < 0.0001 &&
            Math.abs(site.longitude - selectedSpot.longitude) < 0.0001)
      ) || createdSpotIds.has(selectedSpot.id)
    : false;

  const handleCreateFavorite = async () => {
    if (!selectedSpot) return;

    try {
      setFavoriteError(null);
      const site = await createSite.mutateAsync({
        name: selectedSpot.name,
        latitude: selectedSpot.latitude,
        longitude: selectedSpot.longitude,
        elevation_m: selectedSpot.elevation_m
          ? Math.round(selectedSpot.elevation_m)
          : undefined,
        country: selectedSpot.country,
        usage_type: selectedSpotUsageType,
        description: `Ajouté depuis la recherche météo (${selectedSpot.source})`,
      });

      setCreatedSpotIds((ids) => new Set(ids).add(selectedSpot.id));
      onFavoriteCreated(site.id);
    } catch (error) {
      setFavoriteError(
        error instanceof Error
          ? error.message
          : "Impossible d'ajouter ce site aux favoris."
      );
    }
  };

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!selectedTarget) {
      setSelectedOption(null);
    }
  }, [selectedTarget]);

  return (
    <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Recherche météo par ville
        </p>
        <h2 className="text-2xl font-bold text-gray-950 dark:text-white">
          Choisir une ville, un déco ou un atterro proche
        </h2>
        {activeTargetLabel && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Détail météo affiché pour {activeTargetLabel}
          </p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <TextField className="relative flex flex-col gap-1">
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Ville
          </Label>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedLocation(null);
              setSelectedOption(null);
              onSelectTarget(null);
            }}
            onKeyDown={(event) => {
              if (!isSuggestionsOpen || !suggestions.length) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveSuggestionIndex((index) =>
                  Math.min(index + 1, suggestions.length - 1)
                );
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                handleSelectLocation(suggestions[activeSuggestionIndex]);
              }
            }}
            role="combobox"
            aria-expanded={isSuggestionsOpen}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeSuggestionId}
            placeholder="Ex: Besançon, Annecy, Grenoble..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-950 outline-none focus:ring-2 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          {isSuggestionsOpen && (
            <div
              id={listboxId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
            >
              {locationSearch.isLoading ? (
                <div className="p-3 text-sm text-gray-600 dark:text-gray-300">
                  Recherche des villes...
                </div>
              ) : suggestions.length ? (
                suggestions.map((location, index) => (
                  <button
                    id={`${listboxId}-${location.id}`}
                    key={location.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    onClick={() => handleSelectLocation(location)}
                    className={`block w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 dark:border-gray-800 ${
                      index === activeSuggestionIndex
                        ? 'bg-sky-100 dark:bg-sky-950/60'
                        : 'hover:bg-sky-50 dark:hover:bg-sky-950/40'
                    }`}
                  >
                    <span className="block font-medium text-gray-950 dark:text-white">
                      {location.name}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {location.display_name}
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-sm text-gray-600 dark:text-gray-300">
                  Aucune ville trouvée.
                </div>
              )}
            </div>
          )}
        </TextField>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
          Rayon
          <select
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-950 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {radiusChoices.map((radius) => (
              <option key={radius} value={radius}>
                {radius} km
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
          Résultats
          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-950 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {limitChoices.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedLocation && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-gray-950 dark:text-white">
                {selectedLocation.name}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {selectedLocation.display_name}
              </div>
            </div>
            <Button
              onPress={() => handleSelectLocation(selectedLocation)}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Météo ville
            </Button>
          </div>

          {nearbyOptions.isError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Impossible de charger les décollages et atterrissages proches.
            </div>
          ) : nearbyOptions.isLoading ? (
            <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
              Recherche des décollages et atterrissages proches...
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold text-gray-950 dark:text-white">
                  Décollages proches
                </h3>
                <div className="grid gap-2">
                  {nearbyOptions.data?.takeoffs.length ? (
                    nearbyOptions.data.takeoffs.map((spot) => (
                      <OptionButton
                        key={spot.id}
                        label={spot.name}
                        description={spotDescription(spot)}
                        isSelected={
                          selectedOption?.type === 'takeoff' &&
                          selectedOption.spot.id === spot.id
                        }
                        onSelect={() => handleSelectSpot('takeoff', spot)}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Aucun décollage dans ce rayon.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-gray-950 dark:text-white">
                  Atterrissages proches
                </h3>
                <div className="grid gap-2">
                  {nearbyOptions.data?.landings.length ? (
                    nearbyOptions.data.landings.map((spot) => (
                      <OptionButton
                        key={spot.id}
                        label={spot.name}
                        description={spotDescription(spot)}
                        isSelected={
                          selectedOption?.type === 'landing' &&
                          selectedOption.spot.id === spot.id
                        }
                        onSelect={() => handleSelectSpot('landing', spot)}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Aucun atterrissage dans ce rayon.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {weatherTitle && isWeatherError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Impossible de charger la météo pour {weatherTitle}.
            </div>
          ) : weatherTitle ? (
            <div className="space-y-3">
              <WeatherSummaryCard
                title={weatherTitle}
                weather={selectedWeather}
                isLoading={isWeatherLoading}
              />
              {selectedSpot && (
                <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Enregistrer ce site dans vos favoris météo pour le retrouver
                    directement dans la page.
                  </p>
                  <Button
                    onPress={() => void handleCreateFavorite()}
                    isDisabled={createSite.isPending || isSelectedSpotFavorite}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSelectedSpotFavorite
                      ? 'Déjà dans les favoris'
                      : createSite.isPending
                        ? 'Ajout...'
                        : 'Ajouter aux favoris'}
                  </Button>
                  {favoriteError && (
                    <p className="text-sm text-red-600 dark:text-red-300">
                      {favoriteError}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
