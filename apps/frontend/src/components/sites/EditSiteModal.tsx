import React, {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TextField, Label, Input } from 'react-aria-components';
import { Button } from '@dashboard-parapente/design-system';
import { Camera, Check, Loader2, MapPin, Save } from 'lucide-react';
import type {
  LocationSuggestion,
  ParaglidingSpotSearchResult,
  Site,
  SiteUpdate,
  CreateSiteData,
} from '@dashboard-parapente/shared-types';
import { Modal } from '@dashboard-parapente/design-system';
import LandingAssociationsManager from './LandingAssociationsManager';
import {
  useLocationSearch,
  useNearbyFlightOptions,
} from '../../hooks/weather/useCityWeather';
import { useSites } from '../../hooks/sites/useSites';

type SiteFormData = Required<SiteUpdate>;
type SiteUsageType = 'takeoff' | 'landing' | 'both';
type SearchCandidate = {
  spot: ParaglidingSpotSearchResult;
  usageType: SiteUsageType;
};

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium mb-1 dark:text-gray-200';
const radiusChoices = [10, 30, 50, 100];
const limitChoices = [3, 5, 10];

const normalizeSiteName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();

const isCompatibleUsage = (
  siteUsage: Site['usage_type'],
  usage: SiteUsageType
) => siteUsage === usage || siteUsage === 'both' || usage === 'both';

const isDuplicateSite = (site: Site, candidate: SearchCandidate): boolean => {
  const sameName =
    normalizeSiteName(site.name) === normalizeSiteName(candidate.spot.name);
  const sameCoordinates =
    Math.abs(site.latitude - candidate.spot.latitude) < 0.0001 &&
    Math.abs(site.longitude - candidate.spot.longitude) < 0.0001;

  return (
    (sameName || sameCoordinates) &&
    isCompatibleUsage(site.usage_type, candidate.usageType)
  );
};

const mergeSearchCandidates = (
  takeoffs: ParaglidingSpotSearchResult[],
  landings: ParaglidingSpotSearchResult[]
): SearchCandidate[] => {
  const candidates = new Map<string, SearchCandidate>();

  const addCandidate = (
    spot: ParaglidingSpotSearchResult,
    fallbackUsage: Exclude<SiteUsageType, 'both'>
  ) => {
    const usageType = spot.type === 'both' ? 'both' : fallbackUsage;
    const existing = candidates.get(spot.id);

    if (existing) {
      candidates.set(spot.id, {
        spot: { ...existing.spot, ...spot, type: 'both' },
        usageType: 'both',
      });
      return;
    }

    candidates.set(spot.id, { spot, usageType });
  };

  for (const spot of takeoffs) addCandidate(spot, 'takeoff');
  for (const spot of landings) addCandidate(spot, 'landing');

  return [...candidates.values()].sort(
    (a, b) =>
      (a.spot.distance_km ?? Infinity) - (b.spot.distance_km ?? Infinity)
  );
};

interface EditSiteModalProps {
  site: Site | null; // null = create mode, Site = edit mode
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (data: SiteUpdate) => Promise<void>;
  onCreate: (data: CreateSiteData) => Promise<void>;
}

export const EditSiteModal: React.FC<EditSiteModalProps> = ({
  site,
  isOpen,
  onClose,
  onUpdate,
  onCreate,
}) => {
  const { t } = useTranslation();
  const listboxId = useId();
  const isCreateMode = !site;
  const { data: existingSites = [] } = useSites();
  const [formData, setFormData] = useState<SiteFormData>({
    name: '',
    code: '',
    latitude: 0,
    longitude: 0,
    elevation_m: 0,
    region: '',
    country: 'FR',
    orientation: '',
    camera_angle: 180,
    camera_distance: 500,
    camera_close_zoom_percent: 75,
    camera_transition_percent: 12,
    usage_type: 'both',
    description: '',
  });

  // Raw string values for numeric fields (avoids parsing on every keystroke)
  const [latitudeRaw, setLatitudeRaw] = useState('0');
  const [longitudeRaw, setLongitudeRaw] = useState('0');
  const [elevationRaw, setElevationRaw] = useState('0');

  const [originalData, setOriginalData] = useState<SiteFormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSuggestion | null>(null);
  const [radiusKm, setRadiusKm] = useState(30);
  const [limit, setLimit] = useState(5);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const locationSearch = useLocationSearch(
    isCreateMode ? debouncedQuery : '',
    5
  );
  const nearbyOptions = useNearbyFlightOptions(
    isCreateMode ? selectedLocation : null,
    radiusKm,
    limit
  );
  const suggestions = locationSearch.data?.locations ?? [];
  const isSuggestionsOpen =
    isCreateMode && debouncedQuery.length >= 3 && !selectedLocation;
  const activeSuggestion = suggestions[activeSuggestionIndex];
  const activeSuggestionId = activeSuggestion
    ? `${listboxId}-${activeSuggestion.id}`
    : undefined;
  const searchCandidates = useMemo(
    () =>
      mergeSearchCandidates(
        nearbyOptions.data?.takeoffs ?? [],
        nearbyOptions.data?.landings ?? []
      ),
    [nearbyOptions.data?.landings, nearbyOptions.data?.takeoffs]
  );
  const selectedCandidate =
    searchCandidates.find(
      (candidate) => candidate.spot.id === selectedSpotId
    ) ?? null;
  const duplicateSite = selectedCandidate
    ? existingSites.find((existingSite) =>
        isDuplicateSite(existingSite, selectedCandidate)
      )
    : undefined;

  // Initialize form when site changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (site) {
      const initialData = {
        name: site.name,
        code: site.code || '',
        latitude: site.latitude || 0,
        longitude: site.longitude || 0,
        elevation_m: site.elevation_m || 0,
        region: site.region || '',
        country: site.country || 'FR',
        orientation: site.orientation || '',
        camera_angle: site.camera_angle || 180,
        camera_distance: site.camera_distance || 500,
        camera_close_zoom_percent: site.camera_close_zoom_percent || 75,
        camera_transition_percent: site.camera_transition_percent || 12,
        usage_type: site.usage_type || 'both',
        description: site.description || '',
      };
      setFormData(initialData);
      setOriginalData(initialData);
      setLatitudeRaw(String(initialData.latitude));
      setLongitudeRaw(String(initialData.longitude));
      setElevationRaw(String(initialData.elevation_m));
    } else {
      // Reset for create mode
      setFormData({
        name: '',
        code: '',
        latitude: 0,
        longitude: 0,
        elevation_m: 0,
        region: '',
        country: 'FR',
        orientation: '',
        camera_angle: 180,
        camera_distance: 500,
        camera_close_zoom_percent: 75,
        camera_transition_percent: 12,
        usage_type: 'both',
        description: '',
      });
      setOriginalData(null);
      setLatitudeRaw('');
      setLongitudeRaw('');
      setElevationRaw('');
      setQuery('');
      setDebouncedQuery('');
      setSelectedLocation(null);
      setActiveSuggestionIndex(0);
      setSelectedSpotId(null);
    }
    setErrors({});
  }, [site, isOpen]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [debouncedQuery]);

  const handleSelectLocation = (location: LocationSuggestion) => {
    setSelectedLocation(location);
    setSelectedSpotId(null);
    setQuery(location.name);
    setActiveSuggestionIndex(0);
  };

  const handleSelectCandidate = (candidate: SearchCandidate) => {
    const elevation = candidate.spot.elevation_m
      ? Math.round(candidate.spot.elevation_m)
      : 0;

    setSelectedSpotId(candidate.spot.id);
    setFormData((current) => ({
      ...current,
      name: candidate.spot.name,
      latitude: candidate.spot.latitude,
      longitude: candidate.spot.longitude,
      elevation_m: elevation,
      country: candidate.spot.country,
      orientation: candidate.spot.orientation ?? '',
      usage_type: candidate.usageType,
      description: t('editSite.searchSourceDescription', {
        source: candidate.spot.source,
      }),
    }));
    setLatitudeRaw(String(candidate.spot.latitude));
    setLongitudeRaw(String(candidate.spot.longitude));
    setElevationRaw(elevation ? String(elevation) : '');
    setErrors({});
  };

  const parseNumericFields = () => {
    const lat = parseFloat(latitudeRaw) || 0;
    const lon = parseFloat(longitudeRaw) || 0;
    const elev = parseInt(elevationRaw, 10) || 0;
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
      elevation_m: elev,
    }));
    return { latitude: lat, longitude: lon, elevation_m: elev };
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const lat = parseFloat(latitudeRaw) || 0;
    const lon = parseFloat(longitudeRaw) || 0;

    if (!formData.name || formData.name.length < 2) {
      newErrors.name = t('editSite.nameMinLength');
    }

    if (lat < -90 || lat > 90) {
      newErrors.latitude = t('editSite.invalidLatitude');
    }

    if (lon < -180 || lon > 180) {
      newErrors.longitude = t('editSite.invalidLongitude');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = parseNumericFields();

    if (!validate()) return;
    if (duplicateSite) return;

    setIsSaving(true);
    try {
      if (originalData) {
        // Edit mode: only send changed fields
        const current = { ...formData, ...parsed };
        const changedData: SiteUpdate = {};
        for (const [key, value] of Object.entries(current)) {
          if (value !== originalData[key as keyof SiteFormData]) {
            (changedData as Record<string, unknown>)[key] = value;
          }
        }
        await onUpdate(changedData);
      } else {
        // Create mode: formData has all concrete values
        await onCreate({
          name: formData.name,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          ...(formData.code && { code: formData.code }),
          ...(formData.orientation && { orientation: formData.orientation }),
          ...(parsed.elevation_m !== undefined && {
            elevation_m: parsed.elevation_m,
          }),
          ...(formData.region && { region: formData.region }),
          ...(formData.country && { country: formData.country }),
          ...(formData.usage_type && { usage_type: formData.usage_type }),
          ...(formData.description && { description: formData.description }),
        });
      }
      onClose();
    } catch {
      alert(t('editSite.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        site ? `${t('editSite.title')} ${site.name}` : t('editSite.newSite')
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isCreateMode && (
          <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 dark:border-sky-800 dark:bg-sky-950/30">
            <div className="mb-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                {t('editSite.searchExistingTitle')}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {t('editSite.searchExistingHelp')}
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
              <TextField className="relative flex flex-col gap-1">
                <Label className={labelClass}>{t('weather.search.city')}</Label>
                <Input
                  value={query}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setQuery(event.target.value);
                    setSelectedLocation(null);
                    setSelectedSpotId(null);
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (!isSuggestionsOpen || !suggestions.length) return;
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setActiveSuggestionIndex((index) =>
                        Math.min(index + 1, suggestions.length - 1)
                      );
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setActiveSuggestionIndex((index) =>
                        Math.max(index - 1, 0)
                      );
                    } else if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSelectLocation(suggestions[activeSuggestionIndex]);
                    }
                  }}
                  aria-expanded={isSuggestionsOpen}
                  aria-haspopup="listbox"
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-activedescendant={activeSuggestionId}
                  placeholder={t('weather.search.cityPlaceholder')}
                  className={inputClass}
                />
                {isSuggestionsOpen && (
                  <div
                    id={listboxId}
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
                  >
                    {locationSearch.isLoading && (
                      <div className="p-3 text-sm text-gray-600 dark:text-gray-300">
                        {t('weather.search.loadingCities')}
                      </div>
                    )}
                    {!locationSearch.isLoading &&
                      suggestions.length > 0 &&
                      suggestions.map((location, index) => (
                        <button
                          id={`${listboxId}-${location.id}`}
                          key={location.id}
                          type="button"
                          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                          role="option"
                          aria-selected={index === activeSuggestionIndex}
                          onMouseEnter={() => setActiveSuggestionIndex(index)}
                          onClick={() => handleSelectLocation(location)}
                          className={`block w-full cursor-pointer border-b border-gray-100 px-3 py-2 text-left transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 dark:border-gray-800 ${
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
                      ))}
                    {!locationSearch.isLoading && suggestions.length === 0 && (
                      <div className="p-3 text-sm text-gray-600 dark:text-gray-300">
                        {t('weather.search.noCityFound')}
                      </div>
                    )}
                  </div>
                )}
              </TextField>

              <label className="flex flex-col gap-1 text-sm font-medium dark:text-gray-200">
                {t('weather.search.radius')}
                <select
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(Number(event.target.value))}
                  className={inputClass}
                >
                  {radiusChoices.map((radius) => (
                    <option key={radius} value={radius}>
                      {radius} km
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium dark:text-gray-200">
                {t('weather.search.results')}
                <select
                  value={limit}
                  onChange={(event) => setLimit(Number(event.target.value))}
                  className={inputClass}
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
              <div className="mt-4">
                <div className="mb-3 rounded-lg bg-white/80 p-3 text-sm dark:bg-gray-900/70">
                  <div className="font-semibold text-gray-950 dark:text-white">
                    {selectedLocation.name}
                  </div>
                  <div className="text-gray-600 dark:text-gray-300">
                    {selectedLocation.display_name}
                  </div>
                </div>

                {nearbyOptions.isError && (
                  <div
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                    role="alert"
                  >
                    {t('weather.search.nearbyLoadError')}
                  </div>
                )}
                {!nearbyOptions.isError && nearbyOptions.isLoading && (
                  <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                    {t('weather.search.loadingNearby')}
                  </div>
                )}
                {!nearbyOptions.isError &&
                  !nearbyOptions.isLoading &&
                  searchCandidates.length > 0 && (
                    <div className="grid gap-2">
                      {searchCandidates.map((candidate) => {
                        const isSelected = selectedSpotId === candidate.spot.id;
                        let usageLabel = t('editSite.typeLandingShort');
                        if (candidate.usageType === 'both') {
                          usageLabel = t('editSite.typeBothShort');
                        } else if (candidate.usageType === 'takeoff') {
                          usageLabel = t('editSite.typeTakeoffShort');
                        }

                        return (
                          <button
                            key={candidate.spot.id}
                            type="button"
                            onClick={() => handleSelectCandidate(candidate)}
                            className={`cursor-pointer rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                              isSelected
                                ? 'border-sky-500 bg-white ring-2 ring-sky-200 dark:border-sky-400 dark:bg-gray-900 dark:ring-sky-900'
                                : 'border-sky-100 bg-white/80 hover:border-sky-300 dark:border-gray-700 dark:bg-gray-900/60 dark:hover:border-sky-700'
                            }`}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="font-semibold text-gray-950 dark:text-white">
                                  {candidate.spot.name}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                                    {usageLabel}
                                  </span>
                                  {candidate.spot.distance_km != null && (
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                      {candidate.spot.distance_km.toFixed(1)} km
                                    </span>
                                  )}
                                  {candidate.spot.elevation_m != null && (
                                    <span>
                                      {Math.round(candidate.spot.elevation_m)} m
                                    </span>
                                  )}
                                  {candidate.spot.orientation && (
                                    <span>
                                      {t('sites.orientation')}{' '}
                                      {candidate.spot.orientation}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                  <Check
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                  {t('editSite.selectedSite')}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                {!nearbyOptions.isError &&
                  !nearbyOptions.isLoading &&
                  searchCandidates.length === 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white/80 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
                      {t('editSite.noExistingSiteFound')}
                    </div>
                  )}

                {duplicateSite && (
                  <p
                    className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                    role="alert"
                  >
                    {t('editSite.duplicateSite', { name: duplicateSite.name })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Nom */}
        <TextField
          isRequired
          value={formData.name}
          onChange={(v: string) => setFormData({ ...formData, name: v })}
          className="flex flex-col gap-1"
        >
          <Label className={labelClass}>{t('editSite.siteName')} *</Label>
          <Input className={inputClass} />
          {errors.name && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1">
              {errors.name}
            </p>
          )}
        </TextField>

        {/* Code */}
        <TextField
          value={formData.code}
          onChange={(v: string) => setFormData({ ...formData, code: v })}
          isDisabled={!!site}
          className="flex flex-col gap-1"
        >
          <Label className={labelClass}>{t('editSite.code')}</Label>
          <Input
            className={`${inputClass} disabled:bg-gray-100 dark:disabled:bg-gray-600`}
          />
          {site && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('editSite.codeReadonly')}
            </p>
          )}
        </TextField>

        {/* Type de site */}
        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-200">
            {t('editSite.siteType')} *
          </label>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="takeoff"
                checked={formData.usage_type === 'takeoff'}
                onChange={() =>
                  setFormData({ ...formData, usage_type: 'takeoff' })
                }
                className="mr-2"
              />
              <span>{t('sites.takeoffOnly')}</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="landing"
                checked={formData.usage_type === 'landing'}
                onChange={() =>
                  setFormData({ ...formData, usage_type: 'landing' })
                }
                className="mr-2"
              />
              <span>{t('sites.landingOnly')}</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="both"
                checked={formData.usage_type === 'both'}
                onChange={() =>
                  setFormData({ ...formData, usage_type: 'both' })
                }
                className="mr-2"
              />
              <span>{t('editSite.takeoffAndLanding')}</span>
            </label>
          </div>
        </div>

        {/* GPS Coordinates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TextField
            isRequired
            value={latitudeRaw}
            onChange={setLatitudeRaw}
            className="flex flex-col gap-1"
          >
            <Label className={labelClass}>{t('editSite.latitude')} *</Label>
            <Input type="number" step={0.0001} className={inputClass} />
            {errors.latitude && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                {errors.latitude}
              </p>
            )}
          </TextField>

          <TextField
            isRequired
            value={longitudeRaw}
            onChange={setLongitudeRaw}
            className="flex flex-col gap-1"
          >
            <Label className={labelClass}>{t('editSite.longitude')} *</Label>
            <Input type="number" step={0.0001} className={inputClass} />
            {errors.longitude && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                {errors.longitude}
              </p>
            )}
          </TextField>

          <TextField
            value={elevationRaw}
            onChange={setElevationRaw}
            className="flex flex-col gap-1"
          >
            <Label className={labelClass}>{t('editSite.elevation')}</Label>
            <Input type="number" className={inputClass} />
          </TextField>
        </div>

        {/* Locality & Country */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField
            value={formData.region}
            onChange={(v: string) => setFormData({ ...formData, region: v })}
            className="flex flex-col gap-1"
          >
            <Label className={labelClass}>{t('editSite.region')}</Label>
            <Input
              className={inputClass}
              placeholder={t('editSite.regionPlaceholder')}
            />
          </TextField>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">
              {t('editSite.country')}
            </label>
            <select
              value={formData.country}
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
              className={inputClass}
            >
              <option value="FR">{t('editSite.france')}</option>
              <option value="CH">{t('editSite.switzerland')}</option>
              <option value="IT">{t('editSite.italy')}</option>
              <option value="ES">{t('editSite.spain')}</option>
            </select>
          </div>
        </div>

        {/* Orientation */}
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-200">
            {t('editSite.orientation')}
          </label>
          <select
            value={formData.orientation}
            onChange={(e) =>
              setFormData({ ...formData, orientation: e.target.value })
            }
            className={inputClass}
          >
            <option value="">{t('editSite.undefined')}</option>
            <option value="N">Nord (N)</option>
            <option value="NE">Nord-Est (NE)</option>
            <option value="E">Est (E)</option>
            <option value="SE">Sud-Est (SE)</option>
            <option value="S">Sud (S)</option>
            <option value="SW">Sud-Ouest (SW)</option>
            <option value="W">Ouest (W)</option>
            <option value="NW">Nord-Ouest (NW)</option>
          </select>
        </div>

        {/* Camera Settings */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
          <h4 className="text-sm font-semibold mb-3 dark:text-gray-200">
            <Camera
              className="mr-1.5 inline h-4 w-4 align-[-2px]"
              aria-hidden="true"
            />
            {t('editSite.camera3D')}
          </h4>

          <div className="mb-3">
            <label className="block text-sm mb-1">
              {t('editSite.angle')}: {formData.camera_angle}°
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={formData.camera_angle ?? 180}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  camera_angle: parseInt(e.target.value, 10),
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>0° (N)</span>
              <span>90° (E)</span>
              <span>180° (S)</span>
              <span>270° (W)</span>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">
              {t('editSite.distance')}: {formData.camera_distance}m
            </label>
            <input
              type="range"
              min="100"
              max="2000"
              step="50"
              value={formData.camera_distance ?? 500}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  camera_distance: parseInt(e.target.value, 10),
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>100m</span>
              <span>2000m</span>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">
              {t('editSite.closeZoom')}: {formData.camera_close_zoom_percent}%
            </label>
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              value={formData.camera_close_zoom_percent ?? 75}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  camera_close_zoom_percent: parseInt(e.target.value, 10),
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>30%</span>
              <span>100%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">
              {t('editSite.transition')}: {formData.camera_transition_percent}%
            </label>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={formData.camera_transition_percent ?? 12}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  camera_transition_percent: parseInt(e.target.value, 10),
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>1%</span>
              <span>40%</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-200">
            {t('editSite.description')}
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className={inputClass}
            rows={3}
            placeholder={t('editSite.additionalInfo')}
          />
        </div>

        {/* Landing Associations - only for takeoff sites in edit mode */}
        {site &&
          (formData.usage_type === 'takeoff' ||
            formData.usage_type === 'both') && (
            <LandingAssociationsManager takeoffSiteId={site.id} />
          )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            onPress={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer"
            isDisabled={isSaving}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors"
            isDisabled={isSaving || Boolean(duplicateSite)}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {isSaving ? t('editSite.saving') : t('editSite.saveButton')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
