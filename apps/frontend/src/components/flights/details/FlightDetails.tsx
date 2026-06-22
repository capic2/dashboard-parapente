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
} from '@dashboard-parapente/design-system';
import { VIDEO_EXPORT_IN_PROGRESS_STATUSES } from '@dashboard-parapente/shared-types';
import { Edit3, FileUp } from 'lucide-react';
import {
  useUpdateFlight,
  useUploadGPXToFlight,
} from '../../../hooks/flights/useFlights';
import { useVideoExportStatus } from '../../../hooks/flights/useVideoExportStatus';
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
import type { Flight, FlightFormData, Site } from '../../../types';
import { FlightEditForm } from '../edit/FlightEditForm';
import { formatMediaProgressLabel } from '../table/mediaProgress';
import type { DownloadableFlightMedia } from './FlightDetails.types';
import { FlightGenerationLogsPanel } from './FlightGenerationLogsPanel';
import { FlightMediaBadges } from './FlightMediaBadges';
import { FlightMediaExportActions } from './FlightMediaExportActions';
import { FlightNotesSection } from './FlightNotesSection';
import { FlightReplayCard } from './FlightReplayCard';
import { FlightStatsGrid } from './FlightStatsGrid';
import { GoproOverlayJobCard } from './GoproOverlayJobCard';

interface FlightDetailsProps {
  flight: Flight;
  sites: Site[];
  onShowCreateSiteModal: () => void;
  mobileMode?: boolean;
  onCloseMobile?: () => void;
}

type FlightDetailsTab = 'infos' | 'replay';

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
  const [isCancellingGoproOverlay, setIsCancellingGoproOverlay] =
    useState(false);
  const [goproOverlayGpxOffset, setGoproOverlayGpxOffset] = useState('0');
  const [downloadingMedia, setDownloadingMedia] =
    useState<DownloadableFlightMedia | null>(null);

  const hasGpx = Boolean(flight.gpx_file_path);
  const hasVideo = hasFlightVideo(flight);
  const hasGoproCameraVideo = flight.gopro_camera_file_exists === true;
  const hasPersistedGoproOverlay = hasFlightGoproOverlay(flight);
  const effectiveGoproOverlayJobId =
    goproOverlayJobId ?? flight.gopro_overlay_job_id ?? null;
  const { job: streamedGoproOverlayJob } = useGoproOverlayJobStream(
    effectiveGoproOverlayJobId,
    goproOverlayJobToken
  );
  const goproOverlayJob =
    streamedGoproOverlayJob ?? createGoproOverlayJob.data ?? null;
  const { status: videoExportStatus } = useVideoExportStatus(
    flight.video_export_job_id,
    Boolean(flight.video_export_job_id)
  );
  const goproOverlayStatus =
    goproOverlayJob?.status ?? flight.gopro_overlay_status ?? null;
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
    activeFlightIdRef.current = flight.id;
    setActiveTab('infos');
    setHasOpenedReplay(false);
    setEditingMode(false);
    setEditingNotes(false);
    setGoproOverlayJobId(null);
    setGoproOverlayJobToken(null);
    setIsCancellingGoproOverlay(false);
    setGoproOverlayGpxOffset('0');
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
      formData.append('gpx_offset', normalizedGpxOffset);
    }

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
    if (isDownloadingAnyMedia) return;

    setDownloadingMedia('overlay');
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
    } finally {
      setDownloadingMedia(null);
    }
  };

  const goproOverlayAction = isGoproOverlayRunning
    ? handleCancelGoproOverlay
    : handleStartGoproOverlay;
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
              <FlightMediaBadges
                hasGpx={hasGpx}
                hasVideo={hasVideo}
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
            </div>
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
          </div>

          <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
            <label className="mb-3 flex max-w-xs flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
              <span className="font-medium">
                {t('flights.goproOverlayGpxOffsetLabel')}
              </span>
              <input
                type="number"
                step="0.1"
                value={goproOverlayGpxOffset}
                onChange={(event) =>
                  setGoproOverlayGpxOffset(event.currentTarget.value)
                }
                disabled={
                  isGoproOverlayRunning || createGoproOverlayJob.isPending
                }
                className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                aria-label={t('flights.goproOverlayGpxOffsetLabel')}
                aria-describedby="gopro-overlay-gpx-offset-hint"
              />
              <span
                id="gopro-overlay-gpx-offset-hint"
                className="text-xs text-gray-500 dark:text-gray-400"
              >
                {t('flights.goproOverlayGpxOffsetHint')}
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
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

          {goproOverlayJob && (
            <GoproOverlayJobCard
              job={goproOverlayJob}
              isDownloadingAnyMedia={isDownloadingAnyMedia}
              onDownload={handleDownloadGoproOverlay}
            />
          )}
          <FlightGenerationLogsPanel
            videoStatus={videoExportStatus}
            videoFallbackStatus={flight.video_export_status}
            videoFallbackProgress={flight.video_export_progress}
            goproOverlayJob={goproOverlayJob}
            goproOverlayFallbackStatus={flight.gopro_overlay_status}
            goproOverlayFallbackProgress={flight.gopro_overlay_progress}
          />
          <FlightStatsGrid flight={flight} sites={sites} />
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
