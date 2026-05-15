import type { ChangeEvent, FormEvent } from 'react';
import { useState, useRef, lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { TextField, TextArea } from 'react-aria-components';
import {
  Button,
  Modal,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@dashboard-parapente/design-system';
import {
  useUpdateFlight,
  useUploadGPXToFlight,
} from '../../hooks/flights/useFlights';
import {
  useCancelGoproOverlayJob,
  useCreateFlightGoproOverlayJob,
  useGoproOverlayJobStream,
} from '../../hooks/gopro/useGoproOverlay';
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

function sanitizeOverlayBasename(raw: string) {
  const cleaned = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/gu, '_')
    .replace(/[._-]{2,}/gu, '_')
    .replace(/^[._-]+|[._-]+$/gu, '')
    .slice(0, 80);
  return cleaned || 'flight';
}

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
  const createGoproOverlayJob = useCreateFlightGoproOverlayJob(flight.id);
  const cancelGoproOverlayJob = useCancelGoproOverlayJob();
  const resetGoproOverlayJob = createGoproOverlayJob.reset;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeFlightIdRef = useRef(flight.id);

  const [editingMode, setEditingMode] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(flight.notes ?? '');
  const [activeTab, setActiveTab] = useState<FlightDetailsTab>('infos');
  const [hasOpenedReplay, setHasOpenedReplay] = useState(false);
  const [isDownloadingGpx, setIsDownloadingGpx] = useState(false);
  const [goproOverlayJobId, setGoproOverlayJobId] = useState<string | null>(
    null
  );
  const [showGoproOverlayForm, setShowGoproOverlayForm] = useState(false);
  const [goproOverlayVideoPath, setGoproOverlayVideoPath] = useState('');
  const [goproOverlayGpxPath, setGoproOverlayGpxPath] = useState('');
  const [goproOverlayPipPath, setGoproOverlayPipPath] = useState('');
  const [goproOverlayOutputFilename, setGoproOverlayOutputFilename] =
    useState('');

  const hasGpx = Boolean(flight.gpx_file_path);
  const hasVideo = Boolean(flight.video_file_path);
  const { job: streamedGoproOverlayJob } =
    useGoproOverlayJobStream(goproOverlayJobId);
  const goproOverlayJob = streamedGoproOverlayJob ?? createGoproOverlayJob.data;
  const isGoproOverlayRunning =
    goproOverlayJob?.status === 'queued' ||
    goproOverlayJob?.status === 'running';
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
    activeFlightIdRef.current = flight.id;
    setActiveTab('infos');
    setHasOpenedReplay(false);
    setEditingMode(false);
    setEditingNotes(false);
    setGoproOverlayJobId(null);
    setShowGoproOverlayForm(false);
    setGoproOverlayVideoPath('');
    setGoproOverlayGpxPath('');
    setGoproOverlayPipPath('');
    setGoproOverlayOutputFilename('');
    resetGoproOverlayJob();
  }, [flight.id, resetGoproOverlayJob]);

  useEffect(() => {
    setNotesText(flight.notes ?? '');
  }, [flight.notes]);

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

  const handleStartGoproOverlay = () => {
    if (isGoproOverlayRunning) return;

    if (!goproOverlayOutputFilename) {
      setGoproOverlayOutputFilename(
        `${sanitizeOverlayBasename(flightTitle)}-overlay.mp4`
      );
    }
    setShowGoproOverlayForm(true);
  };

  const handleSubmitGoproOverlay = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (isGoproOverlayRunning) return;
    const videoPath = goproOverlayVideoPath.trim();
    const gpxPath = goproOverlayGpxPath.trim();
    const pipPath = goproOverlayPipPath.trim();
    const outputFilename = goproOverlayOutputFilename.trim();

    if (!videoPath) {
      toast.error(t('flights.goproOverlayNeedsCameraVideo'));
      return;
    }
    if (!gpxPath && !hasGpx) {
      toast.error(t('flights.goproOverlayNeedsGpx'));
      return;
    }
    if (!pipPath && !hasVideo) {
      toast.error(t('flights.goproOverlayNeedsPipVideo'));
      return;
    }
    if (!outputFilename) {
      toast.error(t('flights.goproOverlayNeedsOutputFilename'));
      return;
    }

    const requestedFlightId = flight.id;
    const formData = new FormData();
    formData.append('video_path', videoPath);
    formData.append('output_filename', outputFilename);
    if (gpxPath) {
      formData.append('gpx_path', gpxPath);
    }
    if (pipPath) {
      formData.append('pip_path', pipPath);
    }

    try {
      const job = await createGoproOverlayJob.mutateAsync(formData);
      if (activeFlightIdRef.current !== requestedFlightId) return;
      setGoproOverlayJobId(job.job_id);
      setShowGoproOverlayForm(false);
      toast.success(t('flights.goproOverlayStarted'));
    } catch {
      toast.error(t('flights.goproOverlayStartError'));
    }
  };

  const handleCancelGoproOverlay = async () => {
    if (!goproOverlayJob) return;

    try {
      await cancelGoproOverlayJob.mutateAsync(goproOverlayJob.job_id);
      toast.success(t('flights.goproOverlayCancelled'));
    } catch {
      toast.error(t('flights.goproOverlayCancelError'));
    }
  };

  const handleDownloadGoproOverlay = async () => {
    if (!goproOverlayJob || goproOverlayJob.status !== 'completed') return;

    try {
      const blob = await api
        .get(`gopro-overlays/jobs/${goproOverlayJob.job_id}/download`, {
          timeout: false,
        })
        .blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = goproOverlayJob.output_filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('flights.goproOverlayDownloadError'));
    }
  };

  let goproOverlayAction: () => void | Promise<void> = handleStartGoproOverlay;
  let goproOverlayLabel = t('flights.goproOverlayGenerate');
  if (goproOverlayJob?.status === 'completed') {
    goproOverlayAction = handleDownloadGoproOverlay;
    goproOverlayLabel = t('flights.goproOverlayDownload');
  } else if (isGoproOverlayRunning) {
    goproOverlayAction = handleCancelGoproOverlay;
    goproOverlayLabel = t('flights.goproOverlayCancel');
  } else if (createGoproOverlayJob.isPending) {
    goproOverlayLabel = t('flights.goproOverlayStarting');
  }

  let goproOverlayTitle = t('flights.goproOverlayGenerateTitle');
  if (!hasGpx) {
    goproOverlayTitle = t('flights.goproOverlayCanProvideGpx');
  }

  const goproOverlayModal = (
    <Modal
      isOpen={showGoproOverlayForm && !goproOverlayJob}
      onClose={() => setShowGoproOverlayForm(false)}
      title={t('flights.goproOverlayFormTitle')}
      size="lg"
    >
      <form className="space-y-4" onSubmit={handleSubmitGoproOverlay}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('flights.goproOverlayCameraVideo')}
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              type="text"
              value={goproOverlayVideoPath}
              required
              placeholder="camera/GX010001.mp4"
              onChange={(event) => setGoproOverlayVideoPath(event.target.value)}
            />
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {t('flights.goproOverlayPathHelp')}
            </span>
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('flights.goproOverlayGpxFile')}
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              type="text"
              value={goproOverlayGpxPath}
              placeholder="tracks/flight.gpx"
              onChange={(event) => setGoproOverlayGpxPath(event.target.value)}
            />
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {hasGpx
                ? t('flights.goproOverlayGpxFallback')
                : t('flights.goproOverlayNeedsGpx')}
            </span>
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('flights.goproOverlayOsvVideo')}
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              type="text"
              value={goproOverlayPipPath}
              placeholder="exports/flight-pip.mp4"
              onChange={(event) => setGoproOverlayPipPath(event.target.value)}
            />
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {hasVideo
                ? t('flights.goproOverlayPipFallback')
                : t('flights.goproOverlayNeedsPipVideo')}
            </span>
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('flights.goproOverlayOutputFilename')}
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              type="text"
              value={goproOverlayOutputFilename}
              required
              placeholder={`${sanitizeOverlayBasename(flightTitle)}-overlay.mp4`}
              onChange={(event) =>
                setGoproOverlayOutputFilename(event.target.value)
              }
            />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            className="px-4 py-2 text-sm bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            onPress={() => setShowGoproOverlayForm(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            className="px-4 py-2 text-sm bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-cyan-700 dark:hover:bg-cyan-600"
            isDisabled={createGoproOverlayJob.isPending}
          >
            {createGoproOverlayJob.isPending
              ? t('flights.goproOverlayStarting')
              : t('flights.goproOverlayLaunch')}
          </Button>
        </div>
      </form>
    </Modal>
  );

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
                className="px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-all disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-cyan-700 dark:hover:bg-cyan-600"
                onPress={goproOverlayAction}
                isDisabled={
                  createGoproOverlayJob.isPending ||
                  cancelGoproOverlayJob.isPending
                }
                title={goproOverlayTitle}
              >
                {goproOverlayLabel}
              </Button>
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

          {showGoproOverlayForm && !goproOverlayJob && (
            <form
              className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60"
              onSubmit={handleSubmitGoproOverlay}
            >
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                {t('flights.goproOverlayFormTitle')}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('flights.goproOverlayCameraVideo')}
                  <input
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    type="text"
                    value={goproOverlayVideoPath}
                    required
                    onChange={(event) =>
                      setGoproOverlayVideoPath(event.target.value)
                    }
                    placeholder="camera/GX010001.mp4"
                  />
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    {t('flights.goproOverlayPathHelp')}
                  </span>
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('flights.goproOverlayGpxFile')}
                  <input
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    type="text"
                    value={goproOverlayGpxPath}
                    onChange={(event) =>
                      setGoproOverlayGpxPath(event.target.value)
                    }
                    placeholder="tracks/flight.gpx"
                  />
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    {hasGpx
                      ? t('flights.goproOverlayGpxFallback')
                      : t('flights.goproOverlayNeedsGpx')}
                  </span>
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('flights.goproOverlayOsvVideo')}
                  <input
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    type="text"
                    value={goproOverlayPipPath}
                    onChange={(event) =>
                      setGoproOverlayPipPath(event.target.value)
                    }
                    placeholder="exports/flight-pip.mp4"
                  />
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    {hasVideo
                      ? t('flights.goproOverlayPipFallback')
                      : t('flights.goproOverlayNeedsPipVideo')}
                  </span>
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('flights.goproOverlayOutputFilename')}
                  <input
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    type="text"
                    value={goproOverlayOutputFilename}
                    required
                    placeholder={`${sanitizeOverlayBasename(flightTitle)}-overlay.mp4`}
                    onChange={(event) =>
                      setGoproOverlayOutputFilename(event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="submit"
                  className="px-4 py-2 text-sm bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-cyan-700 dark:hover:bg-cyan-600"
                  isDisabled={createGoproOverlayJob.isPending}
                >
                  {createGoproOverlayJob.isPending
                    ? t('flights.goproOverlayStarting')
                    : t('flights.goproOverlayLaunch')}
                </Button>
                <Button
                  type="button"
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  onPress={() => setShowGoproOverlayForm(false)}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          )}

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

          {goproOverlayJob && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t('flights.goproOverlayJobTitle')}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {goproOverlayJob.layout_label} ·{' '}
                    {goproOverlayJob.output_filename}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                  {t(`flights.goproOverlayStatus.${goproOverlayJob.status}`)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(goproOverlayJob.progress, 100)
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-700 dark:text-slate-200">
                {goproOverlayJob.message}
              </p>
              {goproOverlayJob.error && (
                <pre className="mt-2 max-h-36 overflow-auto rounded bg-red-950 p-2 text-xs text-red-50">
                  {goproOverlayJob.error}
                </pre>
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
        {goproOverlayModal}
      </div>
    );
  }

  return (
    <>
      {infoCard}
      {hasGpx ? replayCard : null}
      {goproOverlayModal}
    </>
  );
}
