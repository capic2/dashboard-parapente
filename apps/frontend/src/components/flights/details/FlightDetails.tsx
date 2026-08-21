import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Modal,
} from '@dashboard-parapente/design-system';
import { VIDEO_EXPORT_IN_PROGRESS_STATUSES } from '@dashboard-parapente/shared-types';
import type { GoproOverlayJob } from '@dashboard-parapente/shared-types';
import type { YoutubeVideoAssociation } from '@dashboard-parapente/shared-types';
import { CircleAlert, Edit3, FileUp, Images, Play } from 'lucide-react';
import { Input, Label, TextField } from 'react-aria-components';
import {
  useUpdateFlight,
  useUploadGPXToFlight,
} from '../../../hooks/flights/useFlights';
import { useVideoExportStatus } from '../../../hooks/flights/useVideoExportStatus';
import {
  useRemoveYoutubeVideoAssociation,
  useYoutubeUpload,
  useYoutubeVideoAssociations,
} from '../../../hooks/flights/useYoutubeUpload';
import {
  useCreateFlightGoproOverlayJob,
  useGoproOverlayJobStream,
} from '../../../hooks/gopro/useGoproOverlay';
import { useToast } from '../../../hooks/useToast';
import { api, getApiErrorMessage } from '../../../lib/api';
import {
  hasFlightGoproOverlay,
  hasFlightVideo,
  isGoproOverlayInProgress,
} from '../../../lib/flightMediaState';
import type { Flight, Site } from '../../../types';
import {
  FlightEditForm,
  type FlightEditSubmission,
} from '../edit/FlightEditForm';
import { YoutubeAssociationRemovalModal } from '../YoutubeAssociationRemovalModal';
import { formatMediaProgressLabel } from '../table/mediaProgress';
import type { DownloadableFlightMedia } from './FlightDetails.types';
import { FlightGenerationLogsPanel } from './FlightGenerationLogsPanel';
import { FlightMediaBadges } from './FlightMediaBadges';
import { FlightMediaExportActions } from './FlightMediaExportActions';
import { FlightNotesSection } from './FlightNotesSection';
import { FlightReplayCard } from './FlightReplayCard';
import { FlightStatsGrid } from './FlightStatsGrid';
import { FlightYoutubeVideos } from './FlightYoutubeVideos';
import { GoproOverlayJobCard } from './GoproOverlayJobCard';
import { GoproOverlaySyncPreview } from './GoproOverlaySyncPreview';

interface FlightDetailsProps {
  flight: Flight;
  sites: Site[];
  onShowCreateSiteModal: () => void;
  mobileMode?: boolean;
  onCloseMobile?: () => void;
}

type FlightDetailsTab = 'infos' | 'replay' | 'logs';
type GoproOverlayOutputResolution = 'auto' | 'source' | '1080p' | '4k';

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
  const updateFlight = useUpdateFlight(flight.id);
  const uploadGPXMutation = useUploadGPXToFlight(flight.id);
  const createGoproOverlayJob = useCreateFlightGoproOverlayJob(flight.id);
  const resetGoproOverlayJob = createGoproOverlayJob.reset;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeFlightIdRef = useRef(flight.id);
  const completedEditYoutubeRemovalIdsRef = useRef(new Set<string>());

  const [editingMode, setEditingMode] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(flight.notes ?? '');
  const [activeTab, setActiveTab] = useState<FlightDetailsTab>('infos');
  const [hasOpenedReplay, setHasOpenedReplay] = useState(false);
  const [isGoproOverlayDialogOpen, setIsGoproOverlayDialogOpen] =
    useState(false);
  const [goproOverlayJobId, setGoproOverlayJobId] = useState<string | null>(
    null
  );
  const [goproOverlayJobToken, setGoproOverlayJobToken] = useState<
    string | null
  >(null);
  const [isCancellingGoproOverlay, setIsCancellingGoproOverlay] =
    useState(false);
  const [goproOverlayGpxOffset, setGoproOverlayGpxOffset] = useState(
    String(flight.gopro_overlay_gpx_offset ?? 0)
  );
  const [goproOverlayInitialGpxOffset, setGoproOverlayInitialGpxOffset] =
    useState<string | null>(null);
  const [goproOverlayOutputResolution, setGoproOverlayOutputResolution] =
    useState<GoproOverlayOutputResolution>('auto');
  const [downloadingMedia, setDownloadingMedia] =
    useState<DownloadableFlightMedia | null>(null);
  const [deletingGoproOverlayJobId, setDeletingGoproOverlayJobId] = useState<
    string | null
  >(null);
  const [deletedGoproOverlayJobIds, setDeletedGoproOverlayJobIds] = useState<
    string[]
  >([]);
  const [youtubeRemovalTarget, setYoutubeRemovalTarget] =
    useState<YoutubeVideoAssociation | null>(null);

  const hasGpx = Boolean(flight.gpx_file_path);
  const hasVideo = hasFlightVideo(flight);
  const hasPanoVideo = flight.pano_video_file_exists === true;
  const hasGoproCameraVideo = flight.gopro_camera_file_exists === true;
  const hasPersistedGoproOverlay = hasFlightGoproOverlay(flight);
  const persistedGoproOverlays = flight.gopro_overlays ?? [];
  const activePersistedGoproOverlay = persistedGoproOverlays.find((overlay) =>
    isGoproOverlayInProgress(overlay.status)
  );
  const effectiveGoproOverlayJobId =
    goproOverlayJobId ??
    activePersistedGoproOverlay?.job_id ??
    flight.gopro_overlay_job_id ??
    null;
  const { job: streamedGoproOverlayJob } = useGoproOverlayJobStream(
    effectiveGoproOverlayJobId,
    goproOverlayJobToken
  );
  const goproOverlayJob =
    streamedGoproOverlayJob ?? createGoproOverlayJob.data ?? null;
  const visibleGoproOverlays = [
    ...(goproOverlayJob ? [goproOverlayJob] : []),
    ...persistedGoproOverlays,
  ].filter(
    (overlay, index, overlays) =>
      !deletedGoproOverlayJobIds.includes(overlay.job_id) &&
      overlays.findIndex((candidate) => candidate.job_id === overlay.job_id) ===
        index
  );
  const completedGoproOverlays = visibleGoproOverlays.filter(
    (overlay) => overlay.status === 'completed'
  );
  const processingGoproOverlays = visibleGoproOverlays.filter(
    (overlay) => overlay.status !== 'completed'
  );
  const { status: videoExportStatus } = useVideoExportStatus(
    flight.video_export_job_id,
    Boolean(flight.video_export_job_id)
  );
  const { data: youtubeUploadJob = null } = useYoutubeUpload(flight.id);
  const { data: youtubeAssociations = [] } = useYoutubeVideoAssociations(
    flight.id
  );
  const removeYoutubeAssociation = useRemoveYoutubeVideoAssociation(flight.id);
  const goproOverlayStatus =
    goproOverlayJob?.status ??
    activePersistedGoproOverlay?.status ??
    flight.gopro_overlay_status ??
    null;
  const isGoproOverlayRunning = isGoproOverlayInProgress(goproOverlayStatus);
  const isVideoExportRunning = Boolean(
    flight.video_export_status &&
    VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(flight.video_export_status)
  );
  const isVideoExportFailed = flight.video_export_status === 'failed';
  const isGoproOverlayFailed = goproOverlayStatus === 'failed';
  const isGoproOverlayCancelled = goproOverlayStatus === 'cancelled';
  const canRegenerateGoproOverlay =
    hasPersistedGoproOverlay || isGoproOverlayCancelled;
  const isDownloadingAnyMedia = downloadingMedia !== null;
  let gpxUploadLabel = t('flights.addGpx');
  if (uploadGPXMutation.isPending) {
    gpxUploadLabel = t('flights.uploadInProgress');
  } else if (flight.gpx_file_path) {
    gpxUploadLabel = t('flights.replaceGpx');
  }
  const videoProcessingLabel = formatMediaProgressLabel(
    t('flights.videoProcessingBadge'),
    flight.video_export_progress
  );
  const goproOverlayProcessingLabel = formatMediaProgressLabel(
    t('flights.goproOverlayProcessingBadge'),
    goproOverlayJob?.progress ?? flight.gopro_overlay_progress
  );
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
    if (
      streamedGoproOverlayJob?.status === 'completed' ||
      streamedGoproOverlayJob?.status === 'failed' ||
      streamedGoproOverlayJob?.status === 'cancelled'
    ) {
      void queryClient.invalidateQueries({ queryKey: ['flights'] });
    }
  }, [queryClient, streamedGoproOverlayJob?.status]);

  const handleSubmitEdit = async ({
    values,
    pendingYoutubeRemovals,
  }: FlightEditSubmission) => {
    const remainingRemovals = pendingYoutubeRemovals.filter(
      (removal) =>
        !completedEditYoutubeRemovalIdsRef.current.has(removal.videoId)
    );

    try {
      await updateFlight.mutateAsync({
        ...values,
        youtube_urls: [
          ...(values.youtube_urls ?? []),
          ...remainingRemovals.map((removal) => removal.url),
        ],
      });
    } catch (error) {
      toast.error(await getApiErrorMessage(error, t('flights.updateError')));
      throw error;
    }

    try {
      for (const removal of remainingRemovals) {
        // Each endpoint rewrites the shared URL list, so removals must stay serialized.
        // oxlint-disable-next-line eslint/no-await-in-loop
        await removeYoutubeAssociation.mutateAsync(removal);
        completedEditYoutubeRemovalIdsRef.current.add(removal.videoId);
      }
      completedEditYoutubeRemovalIdsRef.current.clear();
      toast.success(t('flights.updateSuccess'));
      setEditingMode(false);
    } catch (error) {
      toast.error(
        await getApiErrorMessage(
          error,
          t('flights.youtubeAssociationRemoveError')
        )
      );
      throw error;
    }
  };

  const handleCancelEdit = () => {
    completedEditYoutubeRemovalIdsRef.current.clear();
    setEditingMode(false);
  };

  const handleStartEdit = () => {
    completedEditYoutubeRemovalIdsRef.current.clear();
    setEditingMode(true);
  };

  const handleSaveNotes = async () => {
    try {
      await updateFlight.mutateAsync({
        title: normalizedTitle ?? '',
        site_id: flight.site_id ?? null,
        flight_date: flight.flight_date,
        duration_minutes: flight.duration_minutes ?? null,
        max_altitude_m: flight.max_altitude_m ?? null,
        distance_km: flight.distance_km ?? null,
        elevation_gain_m: flight.elevation_gain_m ?? null,
        max_speed_kmh: flight.max_speed_kmh ?? null,
        notes: notesText,
      });
      setEditingNotes(false);
    } catch {
      toast.error(t('flights.updateError'));
    }
  };

  const handleOpenYoutubeRemoval = (url: string) => {
    const association = youtubeAssociations.find(
      (candidate) => candidate.url === url
    );
    if (!association) {
      toast.error(t('flights.youtubeAssociationMetadataError'));
      return;
    }
    setYoutubeRemovalTarget(association);
  };

  const handleRemoveYoutubeAssociation = async (deleteFromYoutube: boolean) => {
    if (!youtubeRemovalTarget) return;

    try {
      await removeYoutubeAssociation.mutateAsync({
        videoId: youtubeRemovalTarget.video_id,
        deleteFromYoutube,
      });
      setYoutubeRemovalTarget(null);
      toast.success(t('flights.youtubeAssociationRemoved'));
    } catch (error) {
      toast.error(
        await getApiErrorMessage(
          error,
          t('flights.youtubeAssociationRemoveError')
        )
      );
    }
  };

  const handleCancelGoproOverlay = async () => {
    if (
      !effectiveGoproOverlayJobId ||
      !confirm(t('flights.goproOverlayConfirmCancel'))
    ) {
      return;
    }

    setIsCancellingGoproOverlay(true);
    try {
      const cancelPath = goproOverlayJobToken
        ? `job-access/gopro-overlays/jobs/${effectiveGoproOverlayJobId}/cancel`
        : `gopro-overlays/jobs/${effectiveGoproOverlayJobId}/cancel`;
      await api.delete(cancelPath, {
        searchParams: goproOverlayJobToken
          ? { access_token: goproOverlayJobToken }
          : undefined,
      });
      void queryClient.invalidateQueries({ queryKey: ['flights'] });
      toast.success(t('flights.goproOverlayCancelled'));
    } catch (error) {
      toast.error(
        await getApiErrorMessage(error, t('flights.goproOverlayCancelError'))
      );
    } finally {
      setIsCancellingGoproOverlay(false);
    }
  };

  const handleGPXUpload = (e: ChangeEvent<HTMLInputElement>) => {
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
    const normalizedGpxOffset = goproOverlayGpxOffset.trim();
    if (normalizedGpxOffset) {
      const parsedOffset = Number(normalizedGpxOffset);
      if (!Number.isFinite(parsedOffset)) {
        toast.error(t('flights.goproOverlayInvalidOffset'));
        return;
      }
    }

    setIsGoproOverlayDialogOpen(false);
    if (normalizedGpxOffset) {
      formData.append('gpx_offset', normalizedGpxOffset);
    }
    formData.append('output_resolution', goproOverlayOutputResolution);

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

  const handleOpenGoproOverlayDialog = () => {
    if (createGoproOverlayJob.isPending || isGoproOverlayRunning) return;
    setGoproOverlayOutputResolution('auto');
    setIsGoproOverlayDialogOpen(true);
    if (flight.gopro_overlay_gpx_offset != null) {
      const storedOffset = String(flight.gopro_overlay_gpx_offset);
      setGoproOverlayInitialGpxOffset(storedOffset);
      setGoproOverlayGpxOffset(storedOffset);
      return;
    }
    setGoproOverlayInitialGpxOffset('0');
    setGoproOverlayGpxOffset('0');
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

  const handleDownloadGoproOverlay = async (job: GoproOverlayJob) => {
    if (job.status !== 'completed') return;
    if (isDownloadingAnyMedia) return;

    setDownloadingMedia('overlay');
    try {
      const jobToken =
        job.job_id === goproOverlayJob?.job_id ? goproOverlayJobToken : null;
      const downloadPath = jobToken
        ? `job-access/gopro-overlays/jobs/${job.job_id}/download`
        : `gopro-overlays/jobs/${job.job_id}/download`;
      const blob = await api
        .get(downloadPath, {
          searchParams: jobToken ? { access_token: jobToken } : undefined,
          timeout: false,
        })
        .blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = job.output_filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('flights.goproOverlayDownloadError'));
    } finally {
      setDownloadingMedia(null);
    }
  };

  const handleDeleteGoproOverlay = async (job: GoproOverlayJob) => {
    if (
      deletingGoproOverlayJobId ||
      !confirm(
        t('flights.goproOverlayConfirmDelete', {
          filename: job.output_filename,
        })
      )
    ) {
      return;
    }

    setDeletingGoproOverlayJobId(job.job_id);
    try {
      await api.delete(`gopro-overlays/jobs/${job.job_id}`);
      setDeletedGoproOverlayJobIds((jobIds) => [...jobIds, job.job_id]);
      if (job.job_id === effectiveGoproOverlayJobId) {
        setGoproOverlayJobId(null);
        setGoproOverlayJobToken(null);
        resetGoproOverlayJob();
      }
      void queryClient.invalidateQueries({ queryKey: ['flights'] });
      toast.success(t('flights.goproOverlayDeleted'));
    } catch (error) {
      toast.error(
        await getApiErrorMessage(error, t('flights.goproOverlayDeleteError'))
      );
    } finally {
      setDeletingGoproOverlayJobId(null);
    }
  };

  const goproOverlayAction = isGoproOverlayRunning
    ? handleCancelGoproOverlay
    : handleOpenGoproOverlayDialog;
  let goproOverlayLabel = t('flights.goproOverlayGenerate');
  let goproOverlayCompactLabel = t('flights.goproOverlayGenerateShort');
  if (isGoproOverlayRunning) {
    goproOverlayLabel = t('flights.goproOverlayCancel');
    goproOverlayCompactLabel = t('flights.goproOverlayCancelShort');
  } else if (createGoproOverlayJob.isPending) {
    goproOverlayLabel = t('flights.goproOverlayInProgress');
    goproOverlayCompactLabel = t('flights.goproOverlayInProgressShort');
  } else if (canRegenerateGoproOverlay) {
    goproOverlayLabel = t('flights.goproOverlayRegenerate');
    goproOverlayCompactLabel = t('flights.goproOverlayRegenerateShort');
  }

  let goproOverlayTitle = canRegenerateGoproOverlay
    ? t('flights.goproOverlayRegenerate')
    : t('flights.goproOverlayGenerateTitle');
  if (isGoproOverlayRunning) {
    goproOverlayTitle = t('flights.goproOverlayCancel');
  } else if (!hasGoproCameraVideo) {
    goproOverlayTitle = t('flights.goproOverlayNeedsCameraVideo');
  } else if (!hasVideo) {
    goproOverlayTitle = t('flights.goproOverlayNeedsVideo');
  }
  let goproOverlayUnavailableReason: string | null = null;
  if (!isGoproOverlayRunning && !hasGoproCameraVideo) {
    goproOverlayUnavailableReason = t('flights.goproOverlayNeedsCameraVideo');
  } else if (!isGoproOverlayRunning && !hasVideo) {
    goproOverlayUnavailableReason = t('flights.goproOverlayNeedsVideo');
  }
  const canUseGoproOverlayAction =
    (isGoproOverlayRunning && Boolean(effectiveGoproOverlayJobId)) ||
    (hasGoproCameraVideo && hasVideo && !isGoproOverlayRunning);
  const hasGenerationLogs = Boolean(
    flight.video_export_job_id ||
    videoExportStatus?.internal_status ||
    videoExportStatus?.status ||
    videoExportStatus?.job_id ||
    flight.video_export_status ||
    goproOverlayJob?.status ||
    goproOverlayJob?.job_id ||
    effectiveGoproOverlayJobId ||
    flight.gopro_overlay_status ||
    persistedGoproOverlays.length > 0 ||
    youtubeUploadJob?.job_id
  );
  const visibleActiveTab =
    !hasGenerationLogs && activeTab === 'logs' ? 'infos' : activeTab;

  const goproOverlayModal = (
    <Modal
      isOpen={isGoproOverlayDialogOpen}
      onClose={() => setIsGoproOverlayDialogOpen(false)}
      title={t('flights.goproOverlayGenerateTitle')}
      size="xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('flights.goproOverlayOffsetDialogDescription')}
        </p>

        {hasPersistedGoproOverlay && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <CircleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{t('flights.goproOverlayAdditionalResolution')}</span>
          </div>
        )}

        <GoproOverlaySyncPreview
          flightId={flight.id}
          offset={goproOverlayGpxOffset}
          onOffsetChange={setGoproOverlayGpxOffset}
        />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="gopro-overlay-output-resolution"
            className="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            {t('flights.goproOverlayOutputResolutionLabel')}
          </label>
          <select
            id="gopro-overlay-output-resolution"
            value={goproOverlayOutputResolution}
            onChange={(event) =>
              setGoproOverlayOutputResolution(
                event.currentTarget.value as GoproOverlayOutputResolution
              )
            }
            className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            aria-describedby="gopro-overlay-output-resolution-hint"
          >
            <option value="auto">
              {t('flights.goproOverlayOutputResolutionAuto')}
            </option>
            <option value="source">
              {t('flights.goproOverlayOutputResolutionSource')}
            </option>
            <option value="1080p">
              {t('flights.goproOverlayOutputResolution1080p')}
            </option>
            <option value="4k">
              {t('flights.goproOverlayOutputResolution4k')}
            </option>
          </select>
          <span
            id="gopro-overlay-output-resolution-hint"
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            {t('flights.goproOverlayOutputResolutionHint')}
          </span>
        </div>

        <TextField className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('flights.goproOverlayGpxOffsetLabel')}
            </Label>
            {goproOverlayInitialGpxOffset !== null && (
              <Button
                variant="ghost"
                className="min-h-8 px-2 py-1 text-xs"
                onPress={() =>
                  setGoproOverlayGpxOffset(goproOverlayInitialGpxOffset)
                }
                isDisabled={
                  goproOverlayGpxOffset === goproOverlayInitialGpxOffset
                }
              >
                {t('common.reset')}
              </Button>
            )}
          </div>
          <Input
            type="number"
            step="0.1"
            value={goproOverlayGpxOffset}
            onChange={(event) =>
              setGoproOverlayGpxOffset(event.currentTarget.value)
            }
            className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            aria-label={t('flights.goproOverlayGpxOffsetLabel')}
            aria-describedby="gopro-overlay-gpx-offset-hint"
          />
          <span
            id="gopro-overlay-gpx-offset-hint"
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            {t('flights.goproOverlayGpxOffsetHint')}
          </span>
        </TextField>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            className="min-h-10 rounded-lg px-3 py-2 text-sm"
            onPress={() => setIsGoproOverlayDialogOpen(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            className="min-h-10 rounded-lg px-3 py-2 text-sm"
            onPress={() => void handleStartGoproOverlay()}
            isDisabled={createGoproOverlayJob.isPending}
          >
            {createGoproOverlayJob.isPending
              ? t('flights.goproOverlayStarting')
              : t('flights.goproOverlayLaunch')}
          </Button>
        </div>
      </div>
    </Modal>
  );

  const infoCard = (
    <div className="rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
      {editingMode ? (
        <FlightEditForm
          flight={flight}
          sites={sites}
          youtubeAssociations={youtubeAssociations}
          onSubmit={handleSubmitEdit}
          onCancel={handleCancelEdit}
          onShowCreateSiteModal={onShowCreateSiteModal}
        />
      ) : (
        <>
          <div className="mb-4 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {flightTitle}
            </h2>
          </div>

          <FlightStatsGrid flight={flight} sites={sites} />

          <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                className="min-h-10 rounded-lg px-3 py-2 text-sm"
                onPress={handleStartEdit}
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
                {gpxUploadLabel}
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx"
            aria-label={t('flights.gpxFileInput')}
            onChange={handleGPXUpload}
            className="hidden"
          />

          <FlightNotesSection
            notes={flight.notes}
            editingNotes={editingNotes}
            notesText={notesText}
            isSaving={updateFlight.isPending}
            onNotesTextChange={setNotesText}
            onStartEdit={() => setEditingNotes(true)}
            onSave={handleSaveNotes}
            onCancel={() => {
              setNotesText(flight.notes ?? '');
              setEditingNotes(false);
            }}
          />
        </>
      )}
    </div>
  );

  const replayCard = (
    <FlightReplayCard
      hasGpx={hasGpx}
      flightId={flight.id}
      flightTitle={flightTitle}
      compact={mobileMode}
    />
  );
  const replayContent =
    hasGpx && !hasOpenedReplay ? (
      <Button
        variant="secondary"
        className="ml-12 min-h-10 rounded-lg px-4 py-2 text-sm"
        onPress={() => setHasOpenedReplay(true)}
      >
        <Play className="h-4 w-4" aria-hidden="true" />
        {t('flights.open3dReplay')}
      </Button>
    ) : (
      replayCard
    );

  const logsPanel = (
    <FlightGenerationLogsPanel
      videoJobId={flight.video_export_job_id}
      videoStatus={videoExportStatus}
      videoFallbackStatus={flight.video_export_status}
      videoFallbackProgress={flight.video_export_progress}
      goproOverlayJob={goproOverlayJob}
      goproOverlayJobId={effectiveGoproOverlayJobId}
      goproOverlayFallbackStatus={flight.gopro_overlay_status}
      goproOverlayFallbackProgress={flight.gopro_overlay_progress}
      youtubeUploadJob={youtubeUploadJob}
    />
  );

  const mediaPanel = (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4 shadow-sm dark:border-indigo-900 dark:from-indigo-950/60 dark:via-gray-900 dark:to-cyan-950/40 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm dark:bg-indigo-500">
            <Images className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">
              {t('flights.mediaPageTitle')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t('flights.mediaPageDescription')}
            </p>
          </div>
        </div>
      </header>

      <FlightMediaExportActions
        flight={flight}
        hasGpx={hasGpx}
        isVideoExportRunning={isVideoExportRunning}
        isGoproOverlayRunning={isGoproOverlayRunning}
        canRegenerateGoproOverlay={canRegenerateGoproOverlay}
        canUseGoproOverlayAction={canUseGoproOverlayAction}
        isCreatingGoproOverlay={createGoproOverlayJob.isPending}
        isCancellingGoproOverlay={isCancellingGoproOverlay}
        goproOverlayLabel={goproOverlayLabel}
        goproOverlayCompactLabel={goproOverlayCompactLabel}
        goproOverlayTitle={goproOverlayTitle}
        goproOverlayUnavailableReason={goproOverlayUnavailableReason}
        onGoproOverlayAction={goproOverlayAction}
      />

      <div className="min-w-0 space-y-4">
        <section aria-labelledby="flight-media-replay-title">
          <div className="mb-3 flex items-start gap-3 px-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
              <Play className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3
                id="flight-media-replay-title"
                className="font-semibold text-slate-950 dark:text-white"
              >
                {t('flights.mediaReplayTitle')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t('flights.mediaReplayDescription')}
              </p>
            </div>
          </div>
          {replayContent}
        </section>

        <FlightMediaBadges
          flight={flight}
          flightId={flight.id}
          hasGpx={hasGpx}
          hasVideo={hasVideo}
          hasPanoVideo={hasPanoVideo}
          hasPersistedGoproOverlay={hasPersistedGoproOverlay}
          isVideoExportRunning={isVideoExportRunning}
          isVideoExportFailed={isVideoExportFailed}
          isGoproOverlayRunning={isGoproOverlayRunning}
          isGoproOverlayFailed={isGoproOverlayFailed}
          isDownloadingAnyMedia={isDownloadingAnyMedia}
          videoProcessingLabel={videoProcessingLabel}
          goproOverlayProcessingLabel={goproOverlayProcessingLabel}
          onDownloadGpx={() => void handleDownloadGpx()}
          onDownloadVideo={() => void handleDownloadVideo()}
          onDownloadPersistedGoproOverlay={() =>
            void handleDownloadPersistedGoproOverlay()
          }
        />

        {completedGoproOverlays.length > 0 && (
          <section
            aria-labelledby="flight-media-overlays-title"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-gray-800 sm:p-5"
          >
            <h3
              id="flight-media-overlays-title"
              className="mb-3 text-base font-semibold text-slate-950 dark:text-white"
            >
              {t('flights.mediaGeneratedOverlaysTitle')}
            </h3>
            <div className="space-y-3">
              {completedGoproOverlays.map((overlay) => (
                <GoproOverlayJobCard
                  key={overlay.job_id}
                  job={overlay}
                  youtubeUploadFlight={flight}
                  isDownloadingAnyMedia={isDownloadingAnyMedia}
                  isDeleting={deletingGoproOverlayJobId === overlay.job_id}
                  onDownload={() => void handleDownloadGoproOverlay(overlay)}
                  onDelete={() => void handleDeleteGoproOverlay(overlay)}
                />
              ))}
            </div>
          </section>
        )}

        {(flight.youtube_urls?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-gray-800 sm:p-5">
            <FlightYoutubeVideos
              urls={flight.youtube_urls}
              removingUrl={
                removeYoutubeAssociation.isPending
                  ? youtubeRemovalTarget?.url
                  : null
              }
              onRemove={handleOpenYoutubeRemoval}
            />
          </div>
        )}
      </div>
      {goproOverlayModal}
      <YoutubeAssociationRemovalModal
        association={youtubeRemovalTarget}
        isPending={removeYoutubeAssociation.isPending}
        onCancel={() => setYoutubeRemovalTarget(null)}
        onRemove={(deleteFromYoutube) =>
          void handleRemoveYoutubeAssociation(deleteFromYoutube)
        }
      />
    </div>
  );

  const processingPanel = (
    <div className="space-y-4">
      {processingGoproOverlays.map((overlay) => (
        <GoproOverlayJobCard
          key={overlay.job_id}
          job={overlay}
          isDownloadingAnyMedia={isDownloadingAnyMedia}
          isDeleting={deletingGoproOverlayJobId === overlay.job_id}
          onDownload={() => void handleDownloadGoproOverlay(overlay)}
          onDelete={() => void handleDeleteGoproOverlay(overlay)}
        />
      ))}
      {hasGenerationLogs ? logsPanel : null}
    </div>
  );

  if (mobileMode) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
          <div className="mb-4 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="px-3 py-2 text-sm"
              onPress={onCloseMobile}
            >
              {t('flights.backToList')}
            </Button>
            <h2 className="truncate text-base font-bold text-gray-900 dark:text-white">
              {flightTitle}
            </h2>
          </div>
        </div>

        <Tabs
          selectedKey={visibleActiveTab}
          onSelectionChange={(key) => {
            const tab = key as FlightDetailsTab;
            setActiveTab(tab);
          }}
          className="space-y-4"
        >
          <TabList
            className={`mb-4 ${hasGenerationLogs ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            <Tab id="infos" className="rounded-md px-3 py-2 text-sm">
              {t('flights.infoTab')}
            </Tab>
            <Tab id="replay" className="rounded-md px-3 py-2 text-sm">
              {t('flights.replayTab')}
            </Tab>
            {hasGenerationLogs && (
              <Tab id="logs" className="rounded-md px-3 py-2 text-sm">
                {t('flights.logsTab')}
              </Tab>
            )}
          </TabList>

          <TabPanel id="infos" className="outline-none">
            {infoCard}
          </TabPanel>
          <TabPanel id="replay" className="outline-none">
            {mediaPanel}
          </TabPanel>
          {hasGenerationLogs && (
            <TabPanel id="logs" className="outline-none">
              {processingPanel}
            </TabPanel>
          )}
        </Tabs>
      </div>
    );
  }

  return (
    <Tabs
      selectedKey={visibleActiveTab}
      onSelectionChange={(key) => {
        const tab = key as FlightDetailsTab;
        setActiveTab(tab);
      }}
      className="space-y-4"
    >
      <TabList
        className="mb-4"
        style={{
          gridTemplateColumns: `repeat(${hasGenerationLogs ? 3 : 2}, minmax(0, 1fr))`,
        }}
      >
        <Tab id="infos">{t('flights.infoTab')}</Tab>
        <Tab id="replay">{t('flights.replayTab')}</Tab>
        {hasGenerationLogs && <Tab id="logs">{t('flights.logsTab')}</Tab>}
      </TabList>
      <TabPanel id="infos">{infoCard}</TabPanel>
      <TabPanel id="replay">{mediaPanel}</TabPanel>
      {hasGenerationLogs && <TabPanel id="logs">{processingPanel}</TabPanel>}
    </Tabs>
  );
}
