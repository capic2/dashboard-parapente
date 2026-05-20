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
import { VIDEO_EXPORT_IN_PROGRESS_STATUSES } from '@dashboard-parapente/shared-types';
import {
  Download,
  Edit3,
  FileText,
  FileUp,
  Layers,
  Video,
  Wand2,
} from 'lucide-react';
import {
  useUpdateFlight,
  useUploadGPXToFlight,
} from '../../hooks/flights/useFlights';
import {
  useCreateFlightGoproOverlayJob,
  useGoproOverlayJobStream,
} from '../../hooks/gopro/useGoproOverlay';
import { useToast } from '../../hooks/useToast';
import { api, getApiErrorMessage } from '../../lib/api';
import type { Flight, FlightFormData, Site } from '../../types';
import { FlightEditForm } from './FlightEditForm';
import {
  formatAltitudeMeters,
  formatDistanceKm,
  formatSpeedKmh,
  useAppSettingsStore,
} from '../../stores/appSettingsStore';
import { FlightVideoExportControls } from './FlightVideoExportControls';

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
type DownloadableFlightMedia = 'gpx' | 'video' | 'overlay';

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
  const createGoproOverlayJob = useCreateFlightGoproOverlayJob(flight.id);
  const resetGoproOverlayJob = createGoproOverlayJob.reset;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeFlightIdRef = useRef(flight.id);

  const [editingMode, setEditingMode] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(flight.notes ?? '');
  const [activeTab, setActiveTab] = useState<FlightDetailsTab>('infos');
  const [hasOpenedReplay, setHasOpenedReplay] = useState(false);
  const [goproOverlayJobId, setGoproOverlayJobId] = useState<string | null>(
    null
  );
  const [goproOverlayJobToken, setGoproOverlayJobToken] = useState<
    string | null
  >(null);
  const [downloadingMedia, setDownloadingMedia] =
    useState<DownloadableFlightMedia | null>(null);

  const hasGpx = Boolean(flight.gpx_file_path);
  const hasVideo = Boolean(
    flight.video_file_path && flight.video_file_exists === true
  );
  const hasGoproCameraVideo = flight.gopro_camera_file_exists === true;
  const hasPersistedGoproOverlay = Boolean(
    flight.gopro_overlay_file_path && flight.gopro_overlay_file_exists !== false
  );
  const effectiveGoproOverlayJobId =
    goproOverlayJobId ?? flight.gopro_overlay_job_id ?? null;
  const { job: streamedGoproOverlayJob } = useGoproOverlayJobStream(
    effectiveGoproOverlayJobId,
    goproOverlayJobToken
  );
  const goproOverlayJob = streamedGoproOverlayJob ?? createGoproOverlayJob.data;
  const goproOverlayStatus =
    goproOverlayJob?.status ?? flight.gopro_overlay_status ?? null;
  const isGoproOverlayRunning =
    goproOverlayStatus === 'queued' || goproOverlayStatus === 'running';
  const isVideoExportRunning = Boolean(
    flight.video_export_status &&
    VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(flight.video_export_status)
  );
  const isVideoExportFailed = flight.video_export_status === 'failed';
  const isGoproOverlayCompleted =
    goproOverlayStatus === 'completed' && hasPersistedGoproOverlay;
  const isGoproOverlayFailed = goproOverlayStatus === 'failed';
  const isDownloadingAnyMedia = downloadingMedia !== null;
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
    setGoproOverlayJobToken(null);
    setDownloadingMedia(null);
    resetGoproOverlayJob();
  }, [flight.id, resetGoproOverlayJob]);

  useEffect(() => {
    setNotesText(flight.notes ?? '');
  }, [flight.notes]);

  useEffect(() => {
    if (
      streamedGoproOverlayJob?.status === 'completed' ||
      streamedGoproOverlayJob?.status === 'failed' ||
      streamedGoproOverlayJob?.status === 'cancelled'
    ) {
      void queryClient.invalidateQueries({ queryKey: ['flights'] });
    }
  }, [queryClient, streamedGoproOverlayJob?.status]);

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

  const handleStartGoproOverlay = async () => {
    if (isGoproOverlayRunning) return;
    if (!hasGoproCameraVideo) {
      toast.error(t('flights.goproOverlayNeedsCameraVideo'));
      return;
    }
    if (!hasVideo) {
      toast.error(t('flights.goproOverlayNeedsVideo'));
      return;
    }

    const requestedFlightId = flight.id;
    const formData = new FormData();

    try {
      const job = await createGoproOverlayJob.mutateAsync(formData);
      if (activeFlightIdRef.current !== requestedFlightId) return;
      setGoproOverlayJobId(job.job_id);
      setGoproOverlayJobToken(job.job_token ?? null);
      void queryClient.invalidateQueries({ queryKey: ['flights'] });
      toast.success(t('flights.goproOverlayStarted'));
    } catch (error) {
      toast.error(
        await getApiErrorMessage(error, t('flights.goproOverlayStartError'))
      );
    }
  };

  const downloadBlob = async (
    path: string,
    filename: string,
    media: DownloadableFlightMedia
  ) => {
    if (isDownloadingAnyMedia) return;

    setDownloadingMedia(media);
    try {
      const blob = await api.get(path, { timeout: false }).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingMedia(null);
    }
  };

  const flightFilename = (extension: string) => {
    const filename = flightTitle.replace(/[^a-zA-Z0-9._-]+/gu, '_');
    return `${filename || flight.id}.${extension}`;
  };

  const handleDownloadGpx = async () => {
    if (!hasGpx) return;

    try {
      await downloadBlob(
        `flights/${flight.id}/gpx`,
        flightFilename('gpx'),
        'gpx'
      );
    } catch {
      toast.error(t('flights.gpxDownloadError'));
    }
  };

  const handleDownloadVideo = async () => {
    if (!hasVideo) return;

    try {
      await downloadBlob(
        `flights/${flight.id}/video`,
        flightFilename('mp4'),
        'video'
      );
    } catch (error) {
      toast.error(
        await getApiErrorMessage(error, t('flights.viewer.videoDownloadError'))
      );
    }
  };

  const handleDownloadPersistedGoproOverlay = async () => {
    if (!hasPersistedGoproOverlay) return;

    try {
      await downloadBlob(
        `flights/${flight.id}/gopro-overlay`,
        flightFilename('mp4'),
        'overlay'
      );
    } catch (error) {
      toast.error(
        await getApiErrorMessage(error, t('flights.goproOverlayDownloadError'))
      );
    }
  };

  const handleDownloadGoproOverlay = async () => {
    if (!goproOverlayJob || goproOverlayJob.status !== 'completed') return;

    try {
      const downloadPath = goproOverlayJobToken
        ? `job-access/gopro-overlays/jobs/${goproOverlayJob.job_id}/download`
        : `gopro-overlays/jobs/${goproOverlayJob.job_id}/download`;
      const blob = await api
        .get(downloadPath, {
          searchParams: goproOverlayJobToken
            ? { access_token: goproOverlayJobToken }
            : undefined,
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

  const goproOverlayAction = handleStartGoproOverlay;
  let goproOverlayLabel = t('flights.goproOverlayGenerate');
  let goproOverlayCompactLabel = t('flights.goproOverlayGenerateShort');
  if (isGoproOverlayRunning || createGoproOverlayJob.isPending) {
    goproOverlayLabel = t('flights.goproOverlayInProgress');
    goproOverlayCompactLabel = t('flights.goproOverlayInProgressShort');
  } else if (isGoproOverlayCompleted) {
    goproOverlayLabel = t('flights.goproOverlayRegenerate');
    goproOverlayCompactLabel = t('flights.goproOverlayRegenerateShort');
  }

  let goproOverlayTitle = isGoproOverlayCompleted
    ? t('flights.goproOverlayRegenerate')
    : t('flights.goproOverlayGenerateTitle');
  if (!hasGoproCameraVideo) {
    goproOverlayTitle = t('flights.goproOverlayNeedsCameraVideo');
  } else if (!hasVideo) {
    goproOverlayTitle = t('flights.goproOverlayNeedsVideo');
  }
  const canUseGoproOverlayAction =
    hasGoproCameraVideo && hasVideo && !isGoproOverlayRunning;

  const infoCard = (
    <div className="rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
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
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {flightTitle}
              </h2>
              {(hasGpx ||
                hasVideo ||
                isVideoExportRunning ||
                isVideoExportFailed ||
                goproOverlayJob ||
                hasPersistedGoproOverlay) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hasGpx && (
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-800 transition-colors hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200 dark:hover:bg-green-900/50 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void handleDownloadGpx()}
                      disabled={isDownloadingAnyMedia}
                      aria-label={t('flights.downloadGpx')}
                    >
                      <FileText className="h-3 w-3" aria-hidden="true" />
                      {t('flights.gpxBadge')}
                      <Download className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                  {hasVideo && (
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-800 transition-colors hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/50 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void handleDownloadVideo()}
                      disabled={isDownloadingAnyMedia}
                      aria-label={t('flights.viewer.downloadVideo')}
                    >
                      <Video className="h-3 w-3" aria-hidden="true" />
                      {t('flights.videoBadge')}
                      <Download className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                  {isVideoExportRunning && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                      {t('flights.videoProcessingBadge')}
                    </span>
                  )}
                  {isVideoExportFailed && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                      {t('flights.videoErrorBadge')}
                    </span>
                  )}
                  {isGoproOverlayCompleted && (
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 transition-colors hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-900/50 dark:focus:ring-offset-gray-800"
                      onClick={() => void handleDownloadPersistedGoproOverlay()}
                      aria-label={t('flights.goproOverlayDownload')}
                    >
                      <Wand2 className="h-3 w-3" aria-hidden="true" />
                      {t('flights.goproOverlayBadge')}
                      <Download className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                  {!isGoproOverlayCompleted &&
                    hasPersistedGoproOverlay &&
                    !isGoproOverlayRunning &&
                    !isGoproOverlayFailed && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 transition-colors hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-900/50 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() =>
                          void handleDownloadPersistedGoproOverlay()
                        }
                        disabled={isDownloadingAnyMedia}
                        aria-label={t('flights.goproOverlayDownload')}
                      >
                        <Wand2 className="h-3 w-3" aria-hidden="true" />
                        {t('flights.goproOverlayBadge')}
                        <Download className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  {isGoproOverlayRunning && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                      {t('flights.goproOverlayProcessingBadge')}
                    </span>
                  )}
                  {isGoproOverlayFailed && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                      {t('flights.goproOverlayErrorBadge')}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-900/50 sm:w-auto sm:min-w-80">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('flights.mediaExportActions')}
                </div>
                {(isVideoExportRunning || isGoproOverlayRunning) && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                    {t('flights.mediaExportInProgress')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {hasGpx ? (
                  <FlightVideoExportControls
                    flight={flight}
                    className="min-w-0"
                    buttonClassName="min-h-10 w-full rounded-lg px-3 py-2 text-sm"
                    compact
                    showModeSelector={false}
                    showCancelAction={false}
                  />
                ) : (
                  <Button
                    variant="outline"
                    className="min-h-10 w-full rounded-lg px-3 py-2 text-sm"
                    isDisabled
                    title={t('flights.replayUnavailable')}
                  >
                    <Video className="h-4 w-4" aria-hidden="true" />
                    {t('flights.viewer.generateVideoShort')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="min-h-10 w-full rounded-lg border-cyan-200 px-3 py-2 text-sm text-cyan-800 transition-colors hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/40"
                  onPress={goproOverlayAction}
                  isDisabled={
                    !canUseGoproOverlayAction || createGoproOverlayJob.isPending
                  }
                  title={goproOverlayTitle}
                  aria-label={goproOverlayLabel}
                >
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                  {goproOverlayCompactLabel}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            <Button
              variant="ghost"
              className="min-h-10 rounded-lg px-3 py-2 text-sm"
              onPress={() => setEditingMode(true)}
              aria-label={t('flights.editFlight')}
            >
              <Edit3 className="h-4 w-4" aria-hidden="true" />
              {t('flights.editButton')}
            </Button>
            <Button
              variant="ghost"
              className="min-h-10 rounded-lg px-3 py-2 text-sm"
              onPress={() => fileInputRef.current?.click()}
              isDisabled={uploadGPXMutation.isPending}
            >
              <FileUp className="h-4 w-4" aria-hidden="true" />
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

          {goproOverlayJob && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="mb-3 flex items-start justify-between gap-3">
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
              {goproOverlayJob.status === 'completed' && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                    {goproOverlayJob.output_filename}
                  </span>
                  <Button
                    type="button"
                    className="min-h-9 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    onPress={handleDownloadGoproOverlay}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t('flights.goproOverlayDownload')}
                  </Button>
                </div>
              )}
              {goproOverlayJob.error && (
                <pre className="mt-2 max-h-36 overflow-auto rounded bg-red-950 p-2 text-xs text-red-50">
                  {goproOverlayJob.error}
                </pre>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 mb-4">
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
              className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
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
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </TextField>
                <div className="flex gap-2">
                  <Button
                    className="rounded-md bg-green-600 px-4 py-2 text-sm text-white transition-all hover:bg-green-700 disabled:opacity-50"
                    onPress={handleSaveNotes}
                    isDisabled={updateFlight.isPending}
                  >
                    {updateFlight.isPending
                      ? t('flights.saving')
                      : t('flights.saveButton')}
                  </Button>
                  <Button
                    className="rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 transition-all hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
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
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">
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
