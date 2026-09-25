import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Edit3,
  Wand2,
} from 'lucide-react';
import { useGoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import { useFlightTelemetry } from '../../../hooks/flights/useFlightTelemetry';
import { useTelemetryLayout } from '../../../hooks/flights/useTelemetryLayout';
import { useVideoExportStatus } from '../../../hooks/flights/useVideoExportStatus';
import {
  getApiErrorMessage,
  getApiUrlWithSearchParams,
} from '../../../lib/api';
import { parseApiUtcDate } from '../../../lib/date';
import { useAuthStore } from '../../../stores/authStore';
import { FlightOverlayPlayer } from './FlightOverlayPlayer';
import { FlightTelemetryOverlay } from './FlightTelemetryOverlay';
import {
  TELEMETRY_CANVAS_HEIGHT,
  TELEMETRY_CANVAS_WIDTH,
  type FlightTelemetryPipLayout,
} from './flightTelemetryLayout';
import { sourceTimeAtPreviewTime } from './GoproOverlaySyncPreview';
import { getYoutubeVideoId } from '../../../lib/youtube';
import { useStartYoutubeOverlayExport } from '../../../hooks/flights/useYoutubeUpload';

interface FlightTelemetryInteractivePreviewProps {
  flightId: string;
  hasFlightVideo?: boolean;
  manualOffsetSeconds?: number;
  youtubeUrls?: string[];
}

const EMPTY_YOUTUBE_URLS: string[] = [];

export function FlightTelemetryInteractivePreview({
  flightId,
  hasFlightVideo = true,
  manualOffsetSeconds,
  youtubeUrls = EMPTY_YOUTUBE_URLS,
}: FlightTelemetryInteractivePreviewProps) {
  const { t } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const overlayPreview = useGoproOverlayPreview(flightId, true);
  const telemetry = useFlightTelemetry(flightId, true);
  const layout = useTelemetryLayout(flightId);
  const [cameraTime, setCameraTime] = useState(0);
  const [youtubeExportError, setYoutubeExportError] = useState<string | null>(
    null
  );
  const [youtubeExportJobId, setYoutubeExportJobId] = useState<string | null>(
    null
  );
  const startExport = useStartYoutubeOverlayExport(flightId);
  const { status: youtubeExportStatus, error: youtubeExportStatusError } =
    useVideoExportStatus(youtubeExportJobId);
  const validYoutubeUrls = youtubeUrls.filter((url) => getYoutubeVideoId(url));
  const [selectedYoutubeIndex, setSelectedYoutubeIndex] = useState(0);
  const activeYoutubeIndex = Math.min(
    selectedYoutubeIndex,
    Math.max(validYoutubeUrls.length - 1, 0)
  );
  const isEnrichmentPending =
    telemetry.data?.enrichment_status === 'pending' ||
    overlayPreview.data?.gpx?.enrichment_status === 'pending';
  const isLoading =
    telemetry.isPending ||
    overlayPreview.isPending ||
    layout.isPending ||
    isEnrichmentPending;
  const isReady =
    telemetry.isSuccess &&
    layout.isSuccess &&
    (overlayPreview.isSuccess || validYoutubeUrls.length > 0) &&
    !isEnrichmentPending &&
    Boolean(telemetry.data?.points.length);
  const showUnavailable = !isLoading && !isEnrichmentPending && !isReady;
  let previewStatusMessage: string;
  if (isLoading || isEnrichmentPending) {
    previewStatusMessage = t('flights.overlayInteractivePreviewLoading');
  } else if (isReady) {
    previewStatusMessage = t('flights.overlayInteractivePreviewReady');
  } else {
    previewStatusMessage = t('flights.overlayInteractivePreviewUnavailable');
  }
  const overlayOffsetSeconds =
    manualOffsetSeconds ??
    overlayPreview.data?.alignment.manual_offset_seconds ??
    0;
  const automaticOffsetSeconds =
    overlayPreview.data?.alignment.automatic_offset_seconds ?? 0;
  // PROTECTED CALIBRATION SYNC CONTRACT — use the same GPX origin and
  // combined offset as GoproOverlaySyncPreview. Changes require explicit
  // user authorization in the current task.
  const calibrationOffsetSeconds =
    automaticOffsetSeconds + overlayOffsetSeconds;
  const telemetryStartTimestamp =
    overlayPreview.data?.gpx?.coordinates[0]?.timestamp ??
    (overlayPreview.data?.gpx?.start_time
      ? parseApiUtcDate(overlayPreview.data.gpx.start_time).getTime()
      : telemetry.data?.points[0]?.timestamp);
  const previewSegments = overlayPreview.data?.video.preview_segments ?? [];
  const pipLayout = layout.data?.layout.find(
    (item): item is FlightTelemetryPipLayout => item.type === 'pip'
  );
  const playerPipLayout = pipLayout
    ? {
        ...pipLayout,
        x: pipLayout.x / TELEMETRY_CANVAS_WIDTH,
        y: pipLayout.y / TELEMETRY_CANVAS_HEIGHT,
        width: pipLayout.width / TELEMETRY_CANVAS_WIDTH,
        height: pipLayout.height / TELEMETRY_CANVAS_HEIGHT,
      }
    : undefined;
  const youtubeUrl = validYoutubeUrls[activeYoutubeIndex];
  const hasYoutubeCarousel = validYoutubeUrls.length > 1;
  const selectYoutubeVideo = (index: number) => {
    if (validYoutubeUrls.length === 0) return;
    setSelectedYoutubeIndex(
      (index + validYoutubeUrls.length) % validYoutubeUrls.length
    );
    setCameraTime(0);
  };
  const youtubeExportStatusValue =
    youtubeExportStatus?.internal_status ?? youtubeExportStatus?.status;
  const youtubeExportProgress = Math.max(
    0,
    Math.min(100, youtubeExportStatus?.progress ?? 0)
  );
  let youtubeExportStatusLabel =
    youtubeExportStatus?.message ?? t('flights.youtubeOverlayExportInProgress');
  if (youtubeExportStatusValue === 'completed') {
    youtubeExportStatusLabel = t('flights.youtubeOverlayExportCompleted');
  } else if (youtubeExportStatusValue === 'failed') {
    youtubeExportStatusLabel = t('flights.youtubeOverlayExportFailed');
  } else if (youtubeExportStatusValue === 'cancelled') {
    youtubeExportStatusLabel = t('flights.youtubeOverlayExportCancelled');
  }
  let youtubeExportProgressClass = 'bg-cyan-500';
  if (youtubeExportStatusValue === 'failed') {
    youtubeExportProgressClass = 'bg-red-500';
  } else if (youtubeExportStatusValue === 'completed') {
    youtubeExportProgressClass = 'bg-emerald-500';
  }
  const launchYoutubeExport = async () => {
    if (!youtubeUrl) return;

    setYoutubeExportError(null);
    try {
      const { job_id } = await startExport.mutateAsync({
        youtube_url: youtubeUrl,
      });
      setYoutubeExportJobId(job_id);
    } catch (error) {
      setYoutubeExportError(
        await getApiErrorMessage(error, t('flights.youtubeOverlayExportError'))
      );
    }
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-gray-800">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            <Wand2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-950 dark:text-white">
              {t('flights.overlayInteractivePreview')}
            </span>
            <span className="block text-sm text-slate-600 dark:text-slate-300">
              {previewStatusMessage}
            </span>
          </span>
          <Link
            to="/flights/$flightId/telemetry-layout"
            params={{ flightId }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-violet-800 dark:bg-gray-900 dark:text-violet-300 dark:hover:bg-violet-950/40"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('telemetryLayout.configure')}
          </Link>
          {youtubeUrl && (
            <Button
              variant="secondary"
              isDisabled={startExport.isPending}
              className="shrink-0 rounded-lg border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-700 dark:border-cyan-800 dark:text-cyan-300"
              onPress={launchYoutubeExport}
            >
              {startExport.isPending
                ? t('common.loading')
                : t('flights.youtubeOverlayExport')}
            </Button>
          )}
        </span>
      </div>
      {(youtubeExportError || startExport.isError) && (
        <p
          className="border-t border-red-200 bg-red-50/70 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300 sm:px-5"
          role="alert"
        >
          {youtubeExportError ?? t('flights.youtubeOverlayExportError')}
        </p>
      )}
      {youtubeExportJobId && (
        <div
          className="border-t border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900 dark:bg-cyan-950/20 sm:px-5"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">
              {t('flights.youtubeOverlayExportProgress')}
            </span>
            <span className="text-slate-700 dark:text-slate-200">
              {youtubeExportStatusValue === 'completed'
                ? t('flights.youtubeOverlayExportCompleted')
                : `${youtubeExportProgress}%`}
            </span>
          </div>
          <progress
            className={`mt-2 block h-2 w-full overflow-hidden rounded-full bg-cyan-100 dark:bg-cyan-950 ${youtubeExportProgressClass}`}
            aria-label={t('flights.youtubeOverlayExportProgress')}
            value={youtubeExportProgress}
            max={100}
          />
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            {youtubeExportStatus?.error ??
              (youtubeExportStatusError
                ? t('flights.youtubeOverlayExportStatusError')
                : youtubeExportStatusLabel)}
          </p>
        </div>
      )}
      <div className="border-t border-slate-200 p-4 dark:border-slate-700 sm:p-5">
        {isLoading && (
          <output
            className="block rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-live="polite"
          >
            {t('flights.overlayInteractivePreviewLoading')}
          </output>
        )}
        {!isLoading && isReady && (
          <div>
            {hasYoutubeCarousel && (
              <div
                className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70"
                aria-label={t('flights.overlayVideoCarouselLabel')}
              >
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  onClick={() => selectYoutubeVideo(activeYoutubeIndex - 1)}
                  aria-label={t('flights.overlayVideoPrevious')}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="min-w-0 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t('flights.overlayVideoPosition', {
                    current: activeYoutubeIndex + 1,
                    total: validYoutubeUrls.length,
                  })}
                </span>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  onClick={() => selectYoutubeVideo(activeYoutubeIndex + 1)}
                  aria-label={t('flights.overlayVideoNext')}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <FlightOverlayPlayer
                key={youtubeUrl ?? 'camera-only'}
                mode="interactive"
                cameraUrl={getApiUrlWithSearchParams(
                  `flights/${flightId}/gopro-camera/preview`,
                  {
                    access_token: token,
                    target_end_seconds: String(
                      overlayPreview.data?.video.preview_target_end_seconds ??
                        ''
                    ),
                    version: `${overlayPreview.data?.video.preview_target_end_seconds}-${overlayPreview.data?.video.preview_available_duration_seconds}`,
                  }
                )}
                flightUrl={
                  hasFlightVideo
                    ? getApiUrlWithSearchParams(`flights/${flightId}/video`, {
                        access_token: token,
                      })
                    : undefined
                }
                youtubeUrl={youtubeUrl}
                getFlightTime={(cameraTime) =>
                  cameraTime - calibrationOffsetSeconds
                }
                cameraLabel={t('flights.goproOverlayCameraPreview')}
                flightLabel={t('flights.goproOverlayFlightVideo')}
                pipLayout={playerPipLayout}
                onTimeChange={(cameraTime) =>
                  setCameraTime(
                    youtubeUrl
                      ? cameraTime
                      : sourceTimeAtPreviewTime(cameraTime, previewSegments)
                  )
                }
                overlayContent={
                  <FlightTelemetryOverlay
                    data={telemetry.data}
                    videoTimeSeconds={cameraTime}
                    offsetSeconds={calibrationOffsetSeconds}
                    timelineStartTimestamp={telemetryStartTimestamp}
                    layout={layout.data?.layout}
                  />
                }
              />
            </div>
          </div>
        )}
        {showUnavailable && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <CircleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{t('flights.overlayInteractivePreviewUnavailable')}</span>
          </div>
        )}
      </div>
    </section>
  );
}
