import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
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
import { Download, Edit3, FileUp, Pencil, Wand2 } from 'lucide-react';
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
type GoproOverlayFieldId =
  | 'videoPath'
  | 'gpxPath'
  | 'pipPath'
  | 'outputDir'
  | 'outputFilename';

const labelClass = 'text-xs text-gray-600 dark:text-gray-300';
const valueClass =
  'block text-sm font-medium text-gray-900 dark:text-white mt-1';

function clampProgress(progress: number) {
  return Math.max(0, Math.min(Math.round(progress), 100));
}

function goproOverlayProgressClass(status: string) {
  if (status === 'completed') return 'accent-emerald-500';
  if (status === 'failed') return 'accent-red-500';
  if (status === 'cancelled') return 'accent-slate-500';
  if (status === 'queued') return 'accent-amber-500';
  return 'accent-cyan-500';
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
  const [goproOverlayOutputDir, setGoproOverlayOutputDir] = useState('');
  const [goproOverlayOutputFilename, setGoproOverlayOutputFilename] =
    useState('');
  const [editingGoproOverlayField, setEditingGoproOverlayField] =
    useState<GoproOverlayFieldId | null>(null);
  const goproOverlayEditInputRef = useRef<HTMLInputElement>(null);

  const hasGpx = Boolean(flight.gpx_file_path);
  const hasVideo = Boolean(flight.video_file_path);
  const { job: streamedGoproOverlayJob } =
    useGoproOverlayJobStream(goproOverlayJobId);
  const goproOverlayJob = streamedGoproOverlayJob ?? createGoproOverlayJob.data;
  const isGoproOverlayRunning =
    goproOverlayJob?.status === 'queued' ||
    goproOverlayJob?.status === 'running';
  const goproOverlayProgress = clampProgress(goproOverlayJob?.progress ?? 0);
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
    setGoproOverlayOutputDir('');
    setGoproOverlayOutputFilename('');
    setEditingGoproOverlayField(null);
    resetGoproOverlayJob();
  }, [flight.id, resetGoproOverlayJob]);

  useEffect(() => {
    setNotesText(flight.notes ?? '');
  }, [flight.notes]);

  useEffect(() => {
    goproOverlayEditInputRef.current?.focus();
  }, [editingGoproOverlayField]);

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
    setShowGoproOverlayForm(true);
  };

  const handleCloseGoproOverlayForm = () => {
    setShowGoproOverlayForm(false);
    setEditingGoproOverlayField(null);
  };

  const handleGoproOverlayFieldKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setEditingGoproOverlayField(null);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditingGoproOverlayField(null);
    }
  };

  const handleSubmitGoproOverlay = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (isGoproOverlayRunning) return;
    const videoPath = goproOverlayVideoPath.trim();
    const gpxPath = goproOverlayGpxPath.trim();
    const pipPath = goproOverlayPipPath.trim();
    const outputDir = goproOverlayOutputDir.trim();
    const outputFilename = goproOverlayOutputFilename.trim();

    const requestedFlightId = flight.id;
    const formData = new FormData();
    if (videoPath) {
      formData.append('video_path', videoPath);
    }
    if (gpxPath) {
      formData.append('gpx_path', gpxPath);
    }
    if (pipPath) {
      formData.append('pip_path', pipPath);
    }
    if (outputDir) {
      formData.append('output_dir', outputDir);
    }
    if (outputFilename) {
      formData.append('output_filename', outputFilename);
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

  const goproOverlayFields: {
    id: GoproOverlayFieldId;
    label: string;
    value: string;
    placeholder: string;
    help?: string;
    onChange: (value: string) => void;
  }[] = [
    {
      id: 'videoPath',
      label: t('flights.goproOverlayCameraVideo'),
      value: goproOverlayVideoPath,
      placeholder: 'parapente/YYYYMMDD/N/camera.mp4',
      help: t('flights.goproOverlayPathHelp'),
      onChange: setGoproOverlayVideoPath,
    },
    {
      id: 'gpxPath',
      label: t('flights.goproOverlayGpxFile'),
      value: goproOverlayGpxPath,
      placeholder: 'parapente/YYYYMMDD/N/Zepp*.gpx',
      help: hasGpx
        ? t('flights.goproOverlayGpxFallback')
        : t('flights.goproOverlayAutoPathHelp'),
      onChange: setGoproOverlayGpxPath,
    },
    {
      id: 'pipPath',
      label: t('flights.goproOverlayOsvVideo'),
      value: goproOverlayPipPath,
      placeholder: 'flight-pip.mp4',
      help: hasVideo
        ? t('flights.goproOverlayPipFallback')
        : t('flights.goproOverlayPipAutoPathHelp'),
      onChange: setGoproOverlayPipPath,
    },
    {
      id: 'outputDir',
      label: t('flights.goproOverlayOutputDir'),
      value: goproOverlayOutputDir,
      placeholder: 'parapente/YYYYMMDD/N',
      help: t('flights.goproOverlayOutputDirFallback'),
      onChange: setGoproOverlayOutputDir,
    },
    {
      id: 'outputFilename',
      label: t('flights.goproOverlayOutputFilename'),
      value: goproOverlayOutputFilename,
      placeholder: 'final.mp4',
      onChange: setGoproOverlayOutputFilename,
    },
  ];

  const goproOverlayFormFields = (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {goproOverlayFields.map((field) => {
        const isEditing = editingGoproOverlayField === field.id;
        const trimmedValue = field.value.trim();
        const fieldInputId = `gopro-overlay-${field.id}`;
        const fieldHelpId = `${fieldInputId}-help`;

        return (
          <div
            key={field.id}
            className="border-b border-slate-200 p-4 last:border-b-0 dark:border-slate-700"
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] md:items-start">
              <div>
                <label
                  htmlFor={fieldInputId}
                  className="text-sm font-semibold text-slate-800 dark:text-slate-100"
                >
                  {field.label}
                </label>
                {field.help && (
                  <p
                    id={fieldHelpId}
                    className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400"
                  >
                    {field.help}
                  </p>
                )}
              </div>

              <div className="min-w-0">
                {isEditing ? (
                  <input
                    id={fieldInputId}
                    className="block min-h-11 w-full rounded-xl border border-sky-400 bg-white px-3 py-2 font-mono text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 dark:border-sky-500 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                    type="text"
                    value={field.value}
                    placeholder={field.placeholder}
                    aria-describedby={field.help ? fieldHelpId : undefined}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={() => setEditingGoproOverlayField(null)}
                    onKeyDown={handleGoproOverlayFieldKeyDown}
                    ref={goproOverlayEditInputRef}
                  />
                ) : (
                  <button
                    type="button"
                    className="block min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-sky-700 dark:hover:bg-sky-950/30 dark:focus:ring-offset-slate-900"
                    onClick={() => setEditingGoproOverlayField(field.id)}
                  >
                    {trimmedValue ? (
                      <span className="block truncate font-mono text-sm font-semibold text-slate-950 dark:text-slate-50">
                        {trimmedValue}
                      </span>
                    ) : (
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                          {t('flights.goproOverlayAutoValue')}
                        </span>
                        <span className="block truncate font-mono text-sm text-slate-600 dark:text-slate-300">
                          {field.placeholder}
                        </span>
                      </span>
                    )}
                  </button>
                )}
              </div>

              <Button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:bg-sky-950/30 dark:hover:text-sky-100 dark:focus:ring-offset-slate-900"
                onPress={() => setEditingGoproOverlayField(field.id)}
                aria-label={t('flights.goproOverlayEditField', {
                  field: field.label,
                })}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                <span>{t('common.edit')}</span>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const goproOverlayFormActions = (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        className="cursor-pointer rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:focus:ring-offset-slate-900"
        onPress={handleCloseGoproOverlayForm}
      >
        {t('common.cancel')}
      </Button>
      <Button
        type="submit"
        className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-cyan-700 dark:hover:bg-cyan-600 dark:focus:ring-offset-slate-900"
        isDisabled={createGoproOverlayJob.isPending}
      >
        {createGoproOverlayJob.isPending
          ? t('flights.goproOverlayStarting')
          : t('flights.goproOverlayLaunch')}
      </Button>
    </div>
  );

  const goproOverlayModal = (
    <Modal
      isOpen={showGoproOverlayForm && !goproOverlayJob}
      onClose={handleCloseGoproOverlayForm}
      title={t('flights.goproOverlayFormTitle')}
      size="lg"
    >
      <form className="space-y-4" onSubmit={handleSubmitGoproOverlay}>
        {goproOverlayFormFields}
        {goproOverlayFormActions}
      </form>
    </Modal>
  );

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
              {(hasGpx || hasVideo) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hasGpx && (
                    <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
                      {t('flights.gpxBadge')}
                    </span>
                  )}
                  {hasVideo && (
                    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                      {t('flights.videoBadge')}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              {hasGpx && (
                <FlightVideoExportControls
                  flight={flight}
                  className="flex flex-col gap-2"
                  buttonClassName="min-h-10 rounded-lg bg-sky-600 px-3 py-2 text-sm hover:bg-sky-700"
                  compact
                  showModeSelector={false}
                />
              )}
              <Button
                variant="outline"
                className="min-h-10 rounded-lg border-cyan-200 px-3 py-2 text-sm text-cyan-800 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/40"
                onPress={goproOverlayAction}
                isDisabled={
                  createGoproOverlayJob.isPending ||
                  cancelGoproOverlayJob.isPending
                }
                title={goproOverlayTitle}
              >
                <Wand2 className="h-4 w-4" aria-hidden="true" />
                {goproOverlayLabel}
              </Button>
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
            {hasGpx && (
              <Button
                variant="ghost"
                className="min-h-10 rounded-lg px-3 py-2 text-sm"
                onPress={handleGPXDownload}
                isDisabled={isDownloadingGpx}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {isDownloadingGpx
                  ? t('flights.gpxDownloadInProgress')
                  : t('flights.downloadGpx')}
              </Button>
            )}
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
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {goproOverlayJob.message}
                </span>
                <span className="font-mono text-sm font-bold text-slate-950 dark:text-white">
                  {goproOverlayProgress}%
                </span>
              </div>
              <progress
                className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300 transition-[accent-color] duration-300 motion-reduce:transition-none dark:bg-slate-800 dark:ring-slate-700 ${goproOverlayProgressClass(goproOverlayJob.status)}`}
                value={goproOverlayProgress}
                max={100}
                aria-label={t('flights.goproOverlayJobTitle')}
              />
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
