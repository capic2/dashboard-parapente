import type { ChangeEvent } from 'react';
import { useState, useRef, lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { TextField, TextArea } from 'react-aria-components';
import {
  Button,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@dashboard-parapente/design-system';
import {
  useUpdateFlight,
  useUploadGPXToFlight,
} from '../../hooks/flights/useFlights';
import { useToast } from '../../hooks/useToast';
import { api } from '../../lib/api';
import type { Flight, FlightFormData, Site } from '../../types';
import { FlightEditForm } from './FlightEditForm';
import {
  formatAltitudeMeters,
  formatDistanceKm,
  formatSpeedKmh,
  useAppSettingsStore,
} from '../../stores/appSettingsStore';

const FlightViewer3D = lazy(() =>
  import('./FlightViewer3D').then((m) => ({
    default: m.FlightViewer3D,
  }))
);

interface FlightDetailsProps {
  flight: Flight;
  sites: Site[];
  onShowCreateSiteModal: () => void;
  mobileMode?: boolean;
  onCloseMobile?: () => void;
}

type FlightDetailsTab = 'infos' | 'replay';

const labelClass = 'text-xs text-gray-600 dark:text-gray-300';
const valueClass =
  'block text-sm font-medium text-gray-900 dark:text-white mt-1';

export function FlightDetails({
  flight,
  sites,
  onShowCreateSiteModal,
  mobileMode = false,
  onCloseMobile,
}: FlightDetailsProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const units = useAppSettingsStore((state) => state.settings.units);
  const updateFlight = useUpdateFlight(flight.id);
  const uploadGPXMutation = useUploadGPXToFlight(flight.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingMode, setEditingMode] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(flight.notes ?? '');
  const [activeTab, setActiveTab] = useState<FlightDetailsTab>('infos');
  const [hasOpenedReplay, setHasOpenedReplay] = useState(false);
  const [isDownloadingGpx, setIsDownloadingGpx] = useState(false);

  const hasGpx = Boolean(flight.gpx_file_path);
  const hasVideo = Boolean(flight.video_file_path);
  const normalizedTitle = flight.title?.trim();
  const flightTitle =
    normalizedTitle ||
    (() => {
      const [y, m, d] = flight.flight_date.split('-');
      const localDate = new Date(Number(y), Number(m) - 1, Number(d));
      return t('flights.flightOf', {
        date: localDate.toLocaleDateString(i18n.language),
      });
    })();

  useEffect(() => {
    setActiveTab('infos');
    setHasOpenedReplay(false);
    setEditingMode(false);
    setEditingNotes(false);
    setNotesText(flight.notes ?? '');
  }, [flight.id, flight.notes]);

  const handleSubmitEdit = async (values: FlightFormData) => {
    await updateFlight.mutateAsync(values);
    toast.success(t('flights.updateSuccess'));
    setEditingMode(false);
  };

  const handleSaveNotes = async () => {
    try {
      await updateFlight.mutateAsync({
        title: normalizedTitle ?? '',
        site_id: flight.site_id ?? null,
        flight_date: flight.flight_date,
        duration_minutes: flight.duration_minutes ?? 0,
        max_altitude_m: flight.max_altitude_m ?? 0,
        distance_km: flight.distance_km ?? 0,
        elevation_gain_m: flight.elevation_gain_m ?? 0,
        notes: notesText,
      });
      setEditingNotes(false);
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  };

  const handleGPXUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('gpx_file', file);

    uploadGPXMutation.mutate(formData, {
      onSuccess: () => {
        toast.success(t('flights.gpxAddedSuccess'));
        queryClient.invalidateQueries({ queryKey: ['flights'] });
      },
      onError: (error: Error) => {
        toast.error(t('flights.gpxUploadError', { error: error.message }));
      },
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGPXDownload = async () => {
    if (!hasGpx || isDownloadingGpx) return;

    setIsDownloadingGpx(true);
    try {
      const blob = await api.get(`flights/${flight.id}/gpx`).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = flightTitle.replace(/[^a-zA-Z0-9._-]+/g, '_');

      a.href = url;
      a.download = `${filename || flight.id}.gpx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download GPX:', error);
      toast.error(t('flights.gpxDownloadError'));
    } finally {
      setIsDownloadingGpx(false);
    }
  };

  const infoCard = (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
      {editingMode ? (
        <FlightEditForm
          flight={flight}
          sites={sites}
          onSubmit={handleSubmitEdit}
          onCancel={() => setEditingMode(false)}
          onShowCreateSiteModal={onShowCreateSiteModal}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {flightTitle}
            </h2>
            <div className="flex flex-col gap-2 sm:ml-4 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                className="px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-all"
                onPress={() => setEditingMode(true)}
                aria-label={t('flights.editFlight')}
              >
                {t('flights.editButton')}
              </Button>
              {hasGpx && (
                <Button
                  className="px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all disabled:cursor-not-allowed disabled:bg-gray-400"
                  onPress={handleGPXDownload}
                  isDisabled={isDownloadingGpx}
                >
                  {isDownloadingGpx
                    ? t('flights.gpxDownloadInProgress')
                    : t('flights.downloadGpx')}
                </Button>
              )}
              <Button
                className={`px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm rounded-md transition-all ${
                  flight.gpx_file_path
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}
                onPress={() => fileInputRef.current?.click()}
                isDisabled={uploadGPXMutation.isPending}
              >
                {uploadGPXMutation.isPending
                  ? t('flights.uploadInProgress')
                  : flight.gpx_file_path
                    ? t('flights.replaceGpx')
                    : t('flights.addGpx')}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx"
              aria-label={t('flights.gpxFileInput')}
              onChange={handleGPXUpload}
              className="hidden"
            />
          </div>

          {(hasGpx || hasVideo) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {hasGpx && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">
                  {t('flights.gpxBadge')}
                </span>
              )}
              {hasVideo && (
                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200">
                  {t('flights.videoBadge')}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div>
              <span className={labelClass}>{t('flights.dateLabel')}</span>
              <span className={valueClass}>
                {(() => {
                  const [year, month, day] = flight.flight_date.split('-');
                  const localDate = new Date(
                    Number(year),
                    Number(month) - 1,
                    Number(day)
                  );
                  return localDate.toLocaleDateString(i18n.language, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });
                })()}
              </span>
            </div>

            <div>
              <span className={labelClass}>{t('flights.departureTime')}</span>
              <span className={valueClass}>
                {flight.departure_time
                  ? new Date(flight.departure_time).toLocaleTimeString(
                      i18n.language,
                      { hour: '2-digit', minute: '2-digit' }
                    )
                  : 'N/A'}
              </span>
            </div>

            <div className="col-span-2 md:col-span-3">
              <span className={labelClass}>{t('flights.siteLabel')}</span>
              <span className={valueClass}>
                {flight.site_name ??
                  flight.site_id ??
                  t('flights.notSpecified')}
              </span>
            </div>

            <div>
              <span className={labelClass}>{t('flights.durationLabel')}</span>
              <span className={valueClass}>
                {flight.duration_minutes != null ? (
                  <>
                    {Math.floor(flight.duration_minutes / 60)}h{' '}
                    {flight.duration_minutes % 60}m
                  </>
                ) : (
                  'N/A'
                )}
              </span>
            </div>

            <div>
              <span className={labelClass}>{t('flights.distanceLabel')}</span>
              <span className={valueClass}>
                {flight.distance_km != null
                  ? formatDistanceKm(flight.distance_km, units.distance)
                  : 'N/A'}
              </span>
            </div>

            <div>
              <span className={labelClass}>
                {t('flights.maxAltitudeLabel')}
              </span>
              <span className={valueClass}>
                {flight.max_altitude_m != null
                  ? formatAltitudeMeters(flight.max_altitude_m, units.altitude)
                  : 'N/A'}
              </span>
            </div>

            <div>
              <span className={labelClass}>
                {t('flights.elevationGainLabel')}
              </span>
              <span className={valueClass}>
                {flight.elevation_gain_m != null
                  ? formatAltitudeMeters(
                      flight.elevation_gain_m,
                      units.altitude
                    )
                  : 'N/A'}
              </span>
            </div>

            <div>
              <span className={labelClass}>{t('flights.maxSpeedLabel')}</span>
              <span className={valueClass}>
                {flight.max_speed_kmh != null
                  ? formatSpeedKmh(flight.max_speed_kmh, units.speed)
                  : 'N/A'}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="flight-notes"
              className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block"
            >
              {t('flights.notesLabel')}
            </label>
            {editingNotes ? (
              <div className="space-y-2">
                <TextField value={notesText} onChange={setNotesText}>
                  <TextArea
                    id="flight-notes"
                    placeholder={t('flights.notesPlaceholder')}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 resize-none dark:bg-gray-700 dark:text-gray-100"
                  />
                </TextField>
                <div className="flex gap-2">
                  <Button
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-all disabled:opacity-50"
                    onPress={handleSaveNotes}
                    isDisabled={updateFlight.isPending}
                  >
                    {updateFlight.isPending
                      ? t('flights.saving')
                      : t('flights.saveButton')}
                  </Button>
                  <Button
                    className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
                    onPress={() => {
                      setNotesText(flight.notes ?? '');
                      setEditingNotes(false);
                    }}
                  >
                    {t('flights.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                {flight.notes ?? t('flights.noNotes')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );

  const replayCard = hasGpx ? (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <Suspense
        fallback={
          <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">
            {t('flights.loading3dViewer')}
          </div>
        }
      >
        <FlightViewer3D
          flightId={flight.id}
          flightTitle={flightTitle}
          compact={mobileMode}
        />
      </Suspense>
    </div>
  ) : (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center">
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {t('flights.replayUnavailable')}
      </p>
    </div>
  );

  if (mobileMode) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="secondary"
              size="sm"
              className="px-3 py-2 text-sm"
              onPress={onCloseMobile}
            >
              {t('flights.backToList')}
            </Button>
            <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
              {flightTitle}
            </h2>
          </div>
        </div>

        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => {
            const tab = key as FlightDetailsTab;
            setActiveTab(tab);
            if (tab === 'replay') {
              setHasOpenedReplay(true);
            }
          }}
          className="space-y-4"
        >
          <TabList className="mb-4 grid-cols-2">
            <Tab id="infos" className="rounded-md px-3 py-2 text-sm">
              {t('flights.infoTab')}
            </Tab>
            <Tab id="replay" className="rounded-md px-3 py-2 text-sm">
              {t('flights.replayTab')}
            </Tab>
          </TabList>

          <TabPanel id="infos" className="outline-none">
            {infoCard}
          </TabPanel>
          <TabPanel id="replay" className="outline-none">
            {hasOpenedReplay ? replayCard : null}
          </TabPanel>
        </Tabs>
      </div>
    );
  }

  return (
    <>
      {infoCard}
      {hasGpx ? replayCard : null}
    </>
  );
}
