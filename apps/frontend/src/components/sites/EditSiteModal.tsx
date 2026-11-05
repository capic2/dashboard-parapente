import React, {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TextField, Label, Input } from 'react-aria-components';
import { Button } from '@dashboard-parapente/core/Button/Button';
import { Camera, Check, Loader2, MapPin, Save } from 'lucide-react';
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
// oxlint-disable-next-line import/no-unassigned-import -- Leaflet requires its stylesheet for map tiles and controls.
import 'leaflet/dist/leaflet.css';
import type {
  LocationSuggestion,
  ParaglidingSpotSearchResult,
  Site,
  SiteUpdate,
  CreateSiteData,
} from '@dashboard-parapente/shared-types';
import { Modal } from '@dashboard-parapente/core/Modal';
import { getApiErrorMessage } from '../../lib/api';
import LandingAssociationsManager from './LandingAssociationsManager';
import {
  useLocationSearch,
  useNearbyFlightOptions,
} from '../../hooks/weather/useCityWeather';
import { useSites } from '../../hooks/sites/useSites';
import {
  useSuggestSitePracticalInfo,
  type SitePracticalInfoKey,
  type SitePracticalInfoSuggestions,
} from '../../hooks/sites/useSiteMutations';

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

const isCompatibleUsage = (
  siteUsage: Site['usage_type'],
  usage: SiteUsageType
) => siteUsage === usage || siteUsage === 'both' || usage === 'both';

const isDuplicateSite = (
  site: Site,
  candidate: {
    latitude: number;
    longitude: number;
    usageType: SiteUsageType;
  }
): boolean => {
  const sameCoordinates =
    Math.abs(site.latitude - candidate.latitude) < 0.0001 &&
    Math.abs(site.longitude - candidate.longitude) < 0.0001;

  return (
    sameCoordinates && isCompatibleUsage(site.usage_type, candidate.usageType)
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

const toMercatorY = (latitude: number) =>
  Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));

const fromMercatorY = (y: number) =>
  ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

const getSiteMapBounds = (marker: { latitude: number; longitude: number }) => {
  const focusRadiusKm = 0.1;
  const latitudeRadius = focusRadiusKm / 110.574;
  const longitudeRadius =
    focusRadiusKm /
    (111.32 * Math.max(Math.cos((marker.latitude * Math.PI) / 180), 0.1));
  const centerLongitude = marker.longitude;
  const centerY = toMercatorY(marker.latitude);
  const northY = toMercatorY(Math.min(85, marker.latitude + latitudeRadius));
  const southY = toMercatorY(Math.max(-85, marker.latitude - latitudeRadius));
  const padding = 1.1;
  let longitudeSpan = 2 * longitudeRadius * padding;
  let mercatorSpan = 2 * Math.max(northY - centerY, centerY - southY) * padding;
  const mapAspectRatio = 2.05;

  longitudeSpan = Math.max(
    longitudeSpan,
    mercatorSpan * (180 / Math.PI) * mapAspectRatio
  );
  mercatorSpan = Math.max(
    mercatorSpan,
    (longitudeSpan * Math.PI) / 180 / mapAspectRatio
  );

  const west = centerLongitude - longitudeSpan / 2;
  const east = centerLongitude + longitudeSpan / 2;
  const south = fromMercatorY(centerY - mercatorSpan / 2);
  const north = fromMercatorY(centerY + mercatorSpan / 2);
  const embedMarkerQuery = `marker=${marker.latitude},${marker.longitude}`;
  const fullMapMarkerQuery = `mlat=${marker.latitude}&mlon=${marker.longitude}`;

  return {
    url: `https://www.openstreetmap.org/export/embed.html?bbox=${west},${south},${east},${north}&layer=mapnik&${embedMarkerQuery}`,
    fullMapUrl: `https://www.openstreetmap.org/?bbox=${west},${south},${east},${north}&${fullMapMarkerQuery}`,
  };
};

interface SiteSearchMapProps {
  location: LocationSuggestion;
  selectedCandidate: SearchCandidate | null;
  pickedCoordinates: { latitude: number; longitude: number } | null;
  mapTitle: string;
  markerLabel: string;
  openMapLabel: string;
  mapPickHelp: string;
  onCoordinatesSelected: (latitude: number, longitude: number) => void;
}

const MapCoordinatePicker: React.FC<{
  onPick: (latitude: number, longitude: number) => void;
}> = ({ onPick }) => {
  useMapEvents({
    click: ({ latlng }) => {
      const { lat, lng } = latlng.wrap();
      onPick(lat, lng);
    },
    contextmenu: ({ latlng }) => {
      const { lat, lng } = latlng.wrap();
      onPick(lat, lng);
    },
  });
  return null;
};

const MapMarkerCenter: React.FC<{ latitude: number; longitude: number }> = ({
  latitude,
  longitude,
}) => {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude]);
  }, [latitude, longitude, map]);
  return null;
};

const SiteSearchMap: React.FC<SiteSearchMapProps> = ({
  location,
  selectedCandidate,
  pickedCoordinates,
  mapTitle,
  markerLabel,
  openMapLabel,
  mapPickHelp,
  onCoordinatesSelected,
}) => {
  const marker = pickedCoordinates ?? selectedCandidate?.spot ?? location;
  const bounds = getSiteMapBounds(marker);

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div
        className="relative h-56 bg-gray-100 dark:bg-gray-800 sm:h-64"
        role="application"
        aria-label={mapTitle}
      >
        <MapContainer
          center={[marker.latitude, marker.longitude]}
          zoom={14}
          scrollWheelZoom
          className="absolute inset-0 h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapMarkerCenter
            latitude={marker.latitude}
            longitude={marker.longitude}
          />
          <CircleMarker
            center={[marker.latitude, marker.longitude]}
            radius={8}
            pathOptions={{
              color: '#0284c7',
              fillColor: '#38bdf8',
              fillOpacity: 0.9,
            }}
          />
          <MapCoordinatePicker
            onPick={(latitude, longitude) =>
              onCoordinatesSelected(latitude, longitude)
            }
          />
        </MapContainer>
      </div>
      <p className="border-t border-gray-200 bg-slate-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
        {mapPickHelp}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900">
        <div className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
            {markerLabel}
          </span>
        </div>
        <a
          href={bounds.fullMapUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 font-medium text-sky-700 underline underline-offset-2 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-sky-300"
        >
          {openMapLabel}
        </a>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-gray-600 underline underline-offset-2 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-gray-300"
        >
          © OpenStreetMap contributors
        </a>
      </div>
    </div>
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
    practical_info: {},
  });

  // Raw string values for numeric fields (avoids parsing on every keystroke)
  const [latitudeRaw, setLatitudeRaw] = useState('0');
  const [longitudeRaw, setLongitudeRaw] = useState('0');
  const [elevationRaw, setElevationRaw] = useState('0');

  const [originalData, setOriginalData] = useState<SiteFormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSuggestion | null>(null);
  const [radiusKm, setRadiusKm] = useState(30);
  const [limit, setLimit] = useState(5);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] =
    useState<SearchCandidate | null>(null);
  const [pickedCoordinates, setPickedCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [suggestionSources, setSuggestionSources] = useState<
    { title: string; url: string }[]
  >([]);
  const [suggestionDraft, setSuggestionDraft] =
    useState<SitePracticalInfoSuggestions | null>(null);
  const [suggestionSiteIdentity, setSuggestionSiteIdentity] = useState<
    string | null
  >(null);
  const [suggestionStatus, setSuggestionStatus] = useState('');
  const [suggestionError, setSuggestionError] = useState('');
  const practicalInfoSuggestion = useSuggestSitePracticalInfo();

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
  const hasDuplicateRelevantChanges =
    isCreateMode ||
    (originalData !== null &&
      (formData.name !== originalData.name ||
        Number(latitudeRaw) !== originalData.latitude ||
        Number(longitudeRaw) !== originalData.longitude ||
        formData.usage_type !== originalData.usage_type));
  const duplicateSite = hasDuplicateRelevantChanges
    ? existingSites.find(
        (existingSite) =>
          existingSite.id !== site?.id &&
          isDuplicateSite(existingSite, {
            latitude: Number(latitudeRaw),
            longitude: Number(longitudeRaw),
            usageType: formData.usage_type,
          })
      )
    : undefined;

  // Initialize form when site changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

    setSelectedSpotId(null);
    setSelectedCandidate(null);
    setPickedCoordinates(null);

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
        practical_info: site.practical_info ?? {},
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
        practical_info: {},
      });
      setOriginalData(null);
      setLatitudeRaw('');
      setLongitudeRaw('');
      setElevationRaw('');
      setQuery('');
      setDebouncedQuery('');
      setSelectedLocation(null);
      setActiveSuggestionIndex(0);
    }
    setErrors({});
    setSaveError('');
    setSuggestionSources([]);
    setSuggestionDraft(null);
    setSuggestionSiteIdentity(null);
    setSuggestionStatus('');
    setSuggestionError('');
  }, [site, isOpen]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [debouncedQuery]);

  const handleSelectLocation = (location: LocationSuggestion) => {
    setSelectedLocation(location);
    setSelectedSpotId(null);
    setSelectedCandidate(null);
    setPickedCoordinates(null);
    setQuery(location.name);
    setActiveSuggestionIndex(0);
    setLatitudeRaw(String(location.latitude));
    setLongitudeRaw(String(location.longitude));
    setFormData((current) => ({
      ...current,
      latitude: location.latitude,
      longitude: location.longitude,
    }));
  };

  const handleSelectCandidate = (candidate: SearchCandidate) => {
    const elevation = candidate.spot.elevation_m
      ? Math.round(candidate.spot.elevation_m)
      : 0;

    setSelectedSpotId(candidate.spot.id);
    setSelectedCandidate(candidate);
    setPickedCoordinates(null);
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

  const handleCoordinateInputChange = (
    coordinate: 'latitude' | 'longitude',
    value: string
  ) => {
    const nextLatitude = coordinate === 'latitude' ? value : latitudeRaw;
    const nextLongitude = coordinate === 'longitude' ? value : longitudeRaw;
    if (coordinate === 'latitude') setLatitudeRaw(value);
    else setLongitudeRaw(value);

    const latitude = Number(nextLatitude);
    const longitude = Number(nextLongitude);
    if (
      nextLatitude.trim() &&
      nextLongitude.trim() &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      setPickedCoordinates({ latitude, longitude });
    } else {
      setPickedCoordinates(null);
    }
    setSelectedCandidate(null);
    setSelectedSpotId(null);
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

  const latitudeForSuggestions = Number(latitudeRaw);
  const longitudeForSuggestions = Number(longitudeRaw);
  const suggestionRequestIdentity = JSON.stringify({
    name: formData.name.trim(),
    latitude: latitudeRaw,
    longitude: longitudeRaw,
    region: formData.region.trim(),
    country: formData.country,
    usage_type: formData.usage_type,
  });
  const latestSuggestionRequestIdentity = useRef(suggestionRequestIdentity);
  latestSuggestionRequestIdentity.current = suggestionRequestIdentity;
  const canSuggestPracticalInfo =
    formData.name.trim().length >= 2 &&
    latitudeRaw.trim() !== '' &&
    longitudeRaw.trim() !== '' &&
    Number.isFinite(latitudeForSuggestions) &&
    latitudeForSuggestions >= -90 &&
    latitudeForSuggestions <= 90 &&
    Number.isFinite(longitudeForSuggestions) &&
    longitudeForSuggestions >= -180 &&
    longitudeForSuggestions <= 180;

  const hasCurrentSiteSuggestions =
    suggestionSiteIdentity === suggestionRequestIdentity;

  let mapMarkerLabelKey = 'editSite.mapCityLegend';
  if (pickedCoordinates) {
    mapMarkerLabelKey = 'editSite.mapCustomCoordinatesLegend';
  } else if (selectedCandidate) {
    mapMarkerLabelKey = 'editSite.mapSelectedSiteLegend';
  }

  const handleSuggestPracticalInfo = async () => {
    const requestIdentity = suggestionRequestIdentity;
    setSuggestionError('');
    setSuggestionStatus('');
    setSuggestionSources([]);
    setSuggestionDraft(null);
    setSuggestionSiteIdentity(null);

    try {
      const result = await practicalInfoSuggestion.mutateAsync({
        name: formData.name.trim(),
        latitude: latitudeForSuggestions,
        longitude: longitudeForSuggestions,
        ...(formData.region.trim() && { region: formData.region.trim() }),
        ...(formData.country && { country: formData.country }),
        usage_type: formData.usage_type,
      });
      if (latestSuggestionRequestIdentity.current !== requestIdentity) return;
      setSuggestionSiteIdentity(requestIdentity);
      setSuggestionSources(result.sources);
      setSuggestionDraft(result);
      setSuggestionStatus(
        Object.values(result.suggestions).some((value) => value.trim())
          ? t('editSite.suggestionsReady')
          : t('editSite.noSuggestions')
      );
    } catch (error) {
      if (latestSuggestionRequestIdentity.current !== requestIdentity) return;
      setSuggestionSiteIdentity(requestIdentity);
      setSuggestionError(
        await getApiErrorMessage(error, t('editSite.suggestionsError'))
      );
    }
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
    setSaveError('');

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
          ...(Object.keys(formData.practical_info).length > 0 && {
            practical_info: formData.practical_info,
          }),
        });
      }
      onClose();
    } catch (error) {
      setSaveError(await getApiErrorMessage(error, t('editSite.saveError')));
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
                    setSelectedCandidate(null);
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

                <SiteSearchMap
                  location={selectedLocation}
                  selectedCandidate={selectedCandidate}
                  pickedCoordinates={pickedCoordinates}
                  mapTitle={t('editSite.mapTitle')}
                  markerLabel={t(mapMarkerLabelKey, {
                    latitude: pickedCoordinates?.latitude.toFixed(5),
                    longitude: pickedCoordinates?.longitude.toFixed(5),
                    name: selectedCandidate?.spot.name,
                  })}
                  openMapLabel={t('editSite.openMap')}
                  mapPickHelp={t('editSite.mapPickHelp')}
                  onCoordinatesSelected={(latitude, longitude) => {
                    setPickedCoordinates({ latitude, longitude });
                    setSelectedCandidate(null);
                    setSelectedSpotId(null);
                    setLatitudeRaw(latitude.toFixed(6));
                    setLongitudeRaw(longitude.toFixed(6));
                    setFormData((current) => ({
                      ...current,
                      latitude,
                      longitude,
                    }));
                    setErrors({});
                  }}
                />

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
              </div>
            )}
          </div>
        )}

        {duplicateSite && (
          <p
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
            role="alert"
          >
            {t('editSite.duplicateSite', { name: duplicateSite.name })}
          </p>
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

        <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <summary className="cursor-pointer font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-white">
            {t('editSite.privatePracticalInfo')} ({t('editSite.optional')})
          </summary>
          <fieldset className="mt-3 space-y-3">
            <legend className="sr-only">
              {t('editSite.privatePracticalInfo')}
            </legend>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t('editSite.privatePracticalInfoHelp')}
            </p>
            <div className="space-y-2">
              <Button
                type="button"
                onPress={handleSuggestPracticalInfo}
                isDisabled={
                  !canSuggestPracticalInfo ||
                  isSaving ||
                  practicalInfoSuggestion.isPending
                }
                className="inline-flex items-center gap-2 rounded bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {practicalInfoSuggestion.isPending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                )}
                {practicalInfoSuggestion.isPending
                  ? t('editSite.searchingSuggestions')
                  : t('editSite.suggestPracticalInfo')}
              </Button>
              {!canSuggestPracticalInfo && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('editSite.suggestionsNeedCoordinates')}
                </p>
              )}
              {hasCurrentSiteSuggestions && suggestionStatus && (
                <p
                  className="text-xs text-emerald-700 dark:text-emerald-300"
                  aria-live="polite"
                >
                  {suggestionStatus}
                </p>
              )}
              {hasCurrentSiteSuggestions && suggestionError && (
                <p
                  className="text-xs text-red-700 dark:text-red-300"
                  role="alert"
                >
                  {suggestionError}
                </p>
              )}
              {hasCurrentSiteSuggestions && suggestionSources.length > 0 && (
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-medium">
                    {t('editSite.suggestionSources')}
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-1">
                    {suggestionSources.map((source) => (
                      <li key={source.url}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-slate-400 underline-offset-2 hover:text-sky-600 dark:hover:text-sky-300"
                        >
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {hasCurrentSiteSuggestions &&
                suggestionDraft?.grounded_result && (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {t(
                        suggestionDraft.grounded_result_is_verified
                          ? 'editSite.groundedSearchResult'
                          : 'editSite.unverifiedSearchResult'
                      )}
                    </p>
                    {!suggestionDraft.grounded_result_is_verified && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {t('editSite.unverifiedSearchResultHelp')}
                      </p>
                    )}
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                      {suggestionDraft.grounded_result}
                    </pre>
                    {suggestionDraft.search_suggestions_html && (
                      <div
                        aria-label={t('editSite.searchSuggestionsTitle')}
                        className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700"
                        dangerouslySetInnerHTML={{
                          __html: suggestionDraft.search_suggestions_html,
                        }}
                      />
                    )}
                  </div>
                )}
            </div>
            {[
              ['access', t('editSite.accessParking')],
              ['rules', t('editSite.localRules')],
              ['webcam', t('editSite.webcamLink')],
              ['contact', t('editSite.clubContact')],
              ['hazards', t('editSite.knownHazards')],
            ].map(([key, label]) => (
              <TextField
                key={key}
                value={formData.practical_info[key] ?? ''}
                onChange={(value: string) =>
                  setFormData({
                    ...formData,
                    practical_info: {
                      ...formData.practical_info,
                      [key]: value,
                    },
                  })
                }
                className="flex flex-col gap-1"
              >
                <Label className={labelClass}>{label}</Label>
                <Input className={inputClass} />
                {hasCurrentSiteSuggestions &&
                  suggestionDraft?.suggestions[
                    key as SitePracticalInfoKey
                  ]?.trim() &&
                  !formData.practical_info[key]?.trim() && (
                    <Button
                      type="button"
                      onPress={() => {
                        const infoKey = key as SitePracticalInfoKey;
                        const suggestedValue =
                          suggestionDraft.suggestions[infoKey];
                        setFormData((current) => ({
                          ...current,
                          practical_info: {
                            ...current.practical_info,
                            ...(current.practical_info[infoKey]?.trim()
                              ? {}
                              : { [infoKey]: suggestedValue }),
                          },
                        }));
                        setSuggestionStatus(t('editSite.suggestionAdded'));
                      }}
                      className="mt-1 self-start rounded px-2 py-1 text-xs font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-sky-300 dark:hover:text-sky-100 cursor-pointer"
                    >
                      {t('editSite.addSuggestion')}
                    </Button>
                  )}
              </TextField>
            ))}
          </fieldset>
        </details>

        {/* GPS Coordinates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TextField
            isRequired
            value={latitudeRaw}
            onChange={(value: string) =>
              handleCoordinateInputChange('latitude', value)
            }
            className="flex flex-col gap-1"
          >
            <Label className={labelClass}>{t('editSite.latitude')} *</Label>
            <Input type="number" step="any" className={inputClass} />
            {errors.latitude && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                {errors.latitude}
              </p>
            )}
          </TextField>

          <TextField
            isRequired
            value={longitudeRaw}
            onChange={(value: string) =>
              handleCoordinateInputChange('longitude', value)
            }
            className="flex flex-col gap-1"
          >
            <Label className={labelClass}>{t('editSite.longitude')} *</Label>
            <Input type="number" step="any" className={inputClass} />
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
            <option value="N">{t('editSite.north')} (N)</option>
            <option value="NE">{t('editSite.northEast')} (NE)</option>
            <option value="E">{t('editSite.east')} (E)</option>
            <option value="SE">{t('editSite.southEast')} (SE)</option>
            <option value="S">{t('editSite.south')} (S)</option>
            <option value="SW">{t('editSite.southWest')} (SW)</option>
            <option value="W">{t('editSite.west')} (W)</option>
            <option value="NW">{t('editSite.northWest')} (NW)</option>
          </select>
        </div>

        {/* Camera Settings */}
        <details className="rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-gray-200">
            <Camera
              className="mr-1.5 inline h-4 w-4 align-[-2px]"
              aria-hidden="true"
            />
            {t('editSite.camera3D')} ({t('editSite.optional')})
          </summary>

          <div className="mt-3">
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
                {t('editSite.transition')}: {formData.camera_transition_percent}
                %
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
        </details>

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
        {saveError && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <p>{saveError}</p>
            <p className="mt-1">{t('editSite.saveRecovery')}</p>
          </div>
        )}
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
            isDisabled={
              isSaving ||
              practicalInfoSuggestion.isPending ||
              Boolean(duplicateSite)
            }
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
