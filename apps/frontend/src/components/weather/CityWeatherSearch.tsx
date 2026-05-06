import { useEffect, useState } from 'react';
import {
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
} from 'react-aria-components';
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

type SelectedOption =
  | { type: 'city'; location: LocationSuggestion }
  | { type: 'takeoff' | 'landing'; spot: ParaglidingSpotSearchResult };

interface CityWeatherSearchProps {
  dayIndex: number;
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
            {weather.slots_summary || weather.explanation || 'Prévision disponible'}
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

export default function CityWeatherSearch({ dayIndex }: CityWeatherSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSuggestion | null>(null);
  const [radiusKm, setRadiusKm] = useState(30);
  const [limit, setLimit] = useState(5);
  const [selectedOption, setSelectedOption] = useState<SelectedOption | null>(
    null
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const locationSearch = useLocationSearch(debouncedQuery, 5);
  const nearbyOptions = useNearbyFlightOptions(selectedLocation, radiusKm, limit);
  const coordinateWeather = useCoordinateWeather(
    selectedOption?.type === 'city' ? selectedOption.location : null,
    dayIndex
  );
  const spotWeather = useSpotWeather(
    selectedOption?.type === 'takeoff' || selectedOption?.type === 'landing'
      ? selectedOption.spot.id
      : null,
    dayIndex
  );

  const weatherTitle =
    selectedOption?.type === 'city'
      ? selectedOption.location.name
      : selectedOption?.spot.name;
  let selectedWeather: BackendWeatherResponse | SpotWeatherResponse | undefined;
  let isWeatherLoading = false;
  if (selectedOption?.type === 'city') {
    selectedWeather = coordinateWeather.data;
    isWeatherLoading = coordinateWeather.isLoading;
  } else if (selectedOption) {
    selectedWeather = spotWeather.data;
    isWeatherLoading = spotWeather.isLoading;
  }

  const handleSelectLocation = (location: LocationSuggestion) => {
    setSelectedLocation(location);
    setSelectedOption({ type: 'city', location });
    setQuery(location.name);
  };

  return (
    <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Recherche météo par ville
        </p>
        <h2 className="text-2xl font-bold text-gray-950 dark:text-white">
          Choisir une ville, un déco ou un atterro proche
        </h2>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <ComboBox<LocationSuggestion>
          items={locationSearch.data?.locations ?? []}
          inputValue={query}
          selectedKey={selectedLocation?.id ?? null}
          allowsCustomValue
          menuTrigger="input"
          onInputChange={(value) => {
            setQuery(value);
            setSelectedLocation(null);
            setSelectedOption(null);
          }}
          onSelectionChange={(key) => {
            if (key == null) return;
            const location = locationSearch.data?.locations.find(
              (item) => item.id === String(key)
            );
            if (location) handleSelectLocation(location);
          }}
          className="relative flex flex-col gap-1"
        >
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Ville
          </Label>
          <Input
            placeholder="Ex: Besançon, Annecy, Grenoble..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-950 outline-none focus:ring-2 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <Popover className="z-20 w-(--trigger-width) overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            {locationSearch.isLoading && debouncedQuery.length >= 3 ? (
              <div className="p-3 text-sm text-gray-600 dark:text-gray-300">
                Recherche des villes...
              </div>
            ) : (
              <ListBox
                aria-label="Suggestions de villes"
                className="max-h-72 overflow-auto outline-none"
              >
                {(location) => (
                  <ListBoxItem
                    id={location.id}
                    textValue={location.name}
                    className="cursor-pointer border-b border-gray-100 px-3 py-2 outline-none last:border-b-0 hover:bg-sky-50 focus:bg-sky-50 dark:border-gray-800 dark:hover:bg-sky-950/40 dark:focus:bg-sky-950/40"
                  >
                    <span className="block font-medium text-gray-950 dark:text-white">
                      {location.name}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {location.display_name}
                    </span>
                  </ListBoxItem>
                )}
              </ListBox>
            )}
          </Popover>
        </ComboBox>

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
              onPress={() => setSelectedOption({ type: 'city', location: selectedLocation })}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Météo ville
            </Button>
          </div>

          {nearbyOptions.isLoading ? (
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
                        isSelected={selectedOption?.type === 'takeoff' && selectedOption.spot.id === spot.id}
                        onSelect={() => setSelectedOption({ type: 'takeoff', spot })}
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
                        isSelected={selectedOption?.type === 'landing' && selectedOption.spot.id === spot.id}
                        onSelect={() => setSelectedOption({ type: 'landing', spot })}
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

          {weatherTitle && (
            <WeatherSummaryCard
              title={weatherTitle}
              weather={selectedWeather}
              isLoading={isWeatherLoading}
            />
          )}
        </div>
      )}
    </section>
  );
}
