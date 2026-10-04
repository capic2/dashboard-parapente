import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { FlightVideoMarker } from '@dashboard-parapente/shared-types';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Edit3,
  ListChecks,
  LoaderCircle,
  Upload,
  Wand2,
} from 'lucide-react';
import { useGoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import { useFlightTelemetry } from '../../../hooks/flights/useFlightTelemetry';
import { useTelemetryLayout } from '../../../hooks/flights/useTelemetryLayout';
import {
  formatEta,
  useVideoExportStatus,
} from '../../../hooks/flights/useVideoExportStatus';
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
  getYoutubePipVideoRole,
  getYoutubeVideoRoleFromTitle,
  type FlightTelemetryPipLayout,
} from './flightTelemetryLayout';
import { sourceTimeAtPreviewTime } from './GoproOverlaySyncPreview';
import { getYoutubeVideoId } from '../../../lib/youtube';
import {
  useStartYoutubeOverlayExport,
  useUploadYoutubeDownloadCookies,
  useYoutubeUpload,
  useYoutubeVideoAssociations,
} from '../../../hooks/flights/useYoutubeUpload';

interface FlightTelemetryInteractivePreviewProps {
  flightId: string;
  hasFlightVideo?: boolean;
  hasFaceVideo?: boolean;
  hasPiloteVideo?: boolean;
  manualOffsetSeconds?: number;
  youtubeUrls?: string[];
  videoMarkers?: FlightVideoMarker[];
  onAddVideoMarker?: (marker: Omit<FlightVideoMarker, 'id'>) => Promise<void>;
  isSavingVideoMarker?: boolean;
}

const EMPTY_YOUTUBE_URLS: string[] = [];
const EMPTY_VIDEO_MARKERS: FlightVideoMarker[] = [];
const YOUTUBE_EXPORT_STALL_THRESHOLD_MS = 5 * 60 * 1000;

function youtubeExportJobStorageKey(flightId: string): string {
  return `youtube-overlay-export-job:${flightId}`;
}

function readYoutubeExportJobId(flightId: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage.getItem(youtubeExportJobStorageKey(flightId));
  } catch {
    return null;
  }
}

function storeYoutubeExportJobId(flightId: string, jobId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(youtubeExportJobStorageKey(flightId), jobId);
  } catch {
    // Keep the export usable when browser storage is unavailable.
  }
}

function clearStoredYoutubeExportJobId(flightId: string, jobId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = youtubeExportJobStorageKey(flightId);
    if (window.sessionStorage.getItem(key) === jobId) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Keep the export usable when browser storage is unavailable.
  }
}

function getTimestampMs(value?: string | null): number | null {
  if (!value) return null;
  const timestamp = parseApiUtcDate(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  const roundedSeconds = Math.floor(seconds);
  if (roundedSeconds < 60) return `${roundedSeconds} s`;
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  if (minutes < 60) return `${minutes} min ${remainingSeconds} s`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${(minutes % 60).toString().padStart(2, '0')} min`;
}

function formatAge(seconds: number | null, language: string): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  const formatter = new Intl.RelativeTimeFormat(language, {
    numeric: 'always',
    style: 'short',
  });
  if (seconds < 60) return formatter.format(-Math.floor(seconds), 'second');
  return formatter.format(-Math.floor(seconds / 60), 'minute');
}

function getYoutubeExportPhase(
  status: string | undefined,
  message: string | null | undefined
): { key: string; fallback: string } {
  const value = `${status ?? ''} ${message ?? ''}`.toLocaleLowerCase();
  if (status === 'queued') {
    return {
      key: 'flights.youtubeOverlayExportPhaseQueued',
      fallback: 'En attente du worker',
    };
  }
  if (status === 'completed') {
    return {
      key: 'flights.youtubeOverlayExportPhaseUpload',
      fallback: 'Vidéo composée, upload YouTube en cours',
    };
  }
  if (value.includes('télécharg') || value.includes('download')) {
    return {
      key: 'flights.youtubeOverlayExportPhaseDownload',
      fallback: 'Téléchargement de la vidéo source',
    };
  }
  if (value.includes('overlay')) {
    return {
      key: 'flights.youtubeOverlayExportPhaseOverlay',
      fallback: 'Génération de l’overlay synchronisé',
    };
  }
  if (value.includes('fusion') || value.includes('ffmpeg')) {
    return {
      key: 'flights.youtubeOverlayExportPhaseCompose',
      fallback: 'Fusion de la vidéo et de l’overlay',
    };
  }
  return {
    key: 'flights.youtubeOverlayExportPhaseProcessing',
    fallback: 'Traitement en cours',
  };
}

export function FlightTelemetryInteractivePreview({
  flightId,
  hasFlightVideo = true,
  hasFaceVideo = false,
  hasPiloteVideo = false,
  manualOffsetSeconds,
  youtubeUrls = EMPTY_YOUTUBE_URLS,
  videoMarkers = EMPTY_VIDEO_MARKERS,
  onAddVideoMarker,
  isSavingVideoMarker = false,
}: FlightTelemetryInteractivePreviewProps) {
  const { t, i18n } = useTranslation();
  const token = useAuthStore((state) => state.token);
  const overlayPreview = useGoproOverlayPreview(flightId, true);
  const telemetry = useFlightTelemetry(flightId, true);
  const layout = useTelemetryLayout(flightId);
  const [cameraTime, setCameraTime] = useState(0);
  const [youtubeExportError, setYoutubeExportError] = useState<string | null>(
    null
  );
  const [youtubeExportJobId, setYoutubeExportJobId] = useState(() =>
    readYoutubeExportJobId(flightId)
  );
  const startExport = useStartYoutubeOverlayExport(flightId);
  const youtubeAssociations = useYoutubeVideoAssociations(flightId);
  const uploadCookies = useUploadYoutubeDownloadCookies();
  const youtubeOverlayUpload = useYoutubeUpload(flightId, {
    source_type: 'youtube_overlay',
  });
  const cookieFileInput = useRef<HTMLInputElement>(null);
  const [cookieUploadMessage, setCookieUploadMessage] = useState<string | null>(
    null
  );
  const [cookieUploadError, setCookieUploadError] = useState<string | null>(
    null
  );
  const { status: youtubeExportStatus, error: youtubeExportStatusError } =
    useVideoExportStatus(youtubeExportJobId);
  const [youtubeExportNow, setYoutubeExportNow] = useState(() => Date.now());
  const validYoutubeUrls = youtubeUrls.filter((url) => getYoutubeVideoId(url));
  const mainVideoSource = layout.data?.layout.mainVideoSource ?? 'auto';
  const publishedOverlayUrl = youtubeOverlayUpload.data?.youtube_url;
  const isYoutubeOverlayPublished = Boolean(
    youtubeOverlayUpload.data?.status === 'completed' &&
    publishedOverlayUrl &&
    youtubeUrls.includes(publishedOverlayUrl) &&
    youtubeAssociations.data?.some(
      (association) =>
        association.url === publishedOverlayUrl &&
        association.exists_on_youtube === true
    )
  );
  const [selectedYoutubeIndex, setSelectedYoutubeIndex] = useState(0);
  const isEnrichmentPending =
    telemetry.data?.enrichment_status === 'pending' ||
    overlayPreview.data?.gpx?.enrichment_status === 'pending';
  const isEnrichmentFailed =
    telemetry.data?.enrichment_status === 'failed' ||
    overlayPreview.data?.gpx?.enrichment_status === 'failed';
  const isLoading =
    telemetry.isPending ||
    overlayPreview.isPending ||
    layout.isPending ||
    isEnrichmentPending;
  const isSelectedLocalMainAvailable =
    (mainVideoSource === 'file:face' && hasFaceVideo) ||
    (mainVideoSource === 'file:pilote' && hasPiloteVideo) ||
    (mainVideoSource === 'file:vol' && hasFlightVideo);
  const isReady =
    telemetry.isSuccess &&
    layout.isSuccess &&
    (overlayPreview.isSuccess ||
      validYoutubeUrls.length > 0 ||
      isSelectedLocalMainAvailable) &&
    !isEnrichmentPending &&
    Boolean(telemetry.data?.points.length);
  const showUnavailable =
    !isLoading && !isEnrichmentPending && !isEnrichmentFailed && !isReady;
  let previewStatusMessage: string;
  if (isLoading || isEnrichmentPending) {
    previewStatusMessage = t('flights.overlayInteractivePreviewLoading');
  } else if (isEnrichmentFailed) {
    previewStatusMessage = t('flights.goproOverlayEnrichmentFailed');
  } else if (isReady) {
    previewStatusMessage = t('flights.overlayInteractivePreviewReady');
  } else {
    previewStatusMessage = t('flights.overlayInteractivePreviewUnavailable');
  }
  const overlayOffsetSeconds =
    typeof manualOffsetSeconds === 'number' &&
    Number.isFinite(manualOffsetSeconds)
      ? manualOffsetSeconds
      : (overlayPreview.data?.alignment.manual_offset_seconds ?? 0);
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
      : (telemetry.data?.points[0]?.timestamp ??
        (telemetry.data?.start_time
          ? parseApiUtcDate(telemetry.data.start_time).getTime()
          : undefined)));
  const previewSegments = overlayPreview.data?.video.preview_segments ?? [];
  const pipLayouts = (layout.data?.layout ?? []).filter(
    (item): item is FlightTelemetryPipLayout =>
      item.type === 'pip' && item.visible
  );
  const youtubeUrlForRole = (
    role: ReturnType<typeof getYoutubePipVideoRole>
  ) =>
    role
      ? (youtubeAssociations.data ?? []).find(
          (association) =>
            validYoutubeUrls.includes(association.url) &&
            getYoutubeVideoRoleFromTitle(association.title) === role
        )?.url
      : undefined;
  const cameraUrl = getApiUrlWithSearchParams(
    `flights/${flightId}/gopro-camera/preview`,
    {
      access_token: token,
      target_end_seconds: String(
        overlayPreview.data?.video.preview_target_end_seconds ?? ''
      ),
      version: `${overlayPreview.data?.video.preview_target_end_seconds}-${overlayPreview.data?.video.preview_available_duration_seconds}`,
    }
  );
  const flightUrl = hasFlightVideo
    ? getApiUrlWithSearchParams(`flights/${flightId}/video`, {
        access_token: token,
      })
    : undefined;
  const faceUrl = hasFaceVideo
    ? getApiUrlWithSearchParams(`flights/${flightId}/temporary-media/face`, {
        access_token: token,
      })
    : undefined;
  const piloteUrl = hasPiloteVideo
    ? getApiUrlWithSearchParams(`flights/${flightId}/temporary-media/pilote`, {
        access_token: token,
      })
    : undefined;
  const playerPips = pipLayouts.map((pip) => {
    const role = getYoutubePipVideoRole(pip.source);
    const youtubePipUrl = role ? youtubeUrlForRole(role) : undefined;
    let videoUrl: string | undefined;
    if (pip.source === 'file:face') videoUrl = faceUrl;
    else if (pip.source === 'file:pilote') videoUrl = piloteUrl;
    else if (pip.source === 'file:vol') videoUrl = flightUrl;

    let label = t('flights.goproOverlayFlightVideo');
    if (role === 'face' || pip.source === 'file:face') {
      label = t('flights.faceBadge');
    } else if (role === 'pilote' || pip.source === 'file:pilote') {
      label = t('flights.piloteBadge');
    }
    return {
      ...pip,
      x: pip.x / TELEMETRY_CANVAS_WIDTH,
      y: pip.y / TELEMETRY_CANVAS_HEIGHT,
      width: pip.width / TELEMETRY_CANVAS_WIDTH,
      height: pip.height / TELEMETRY_CANVAS_HEIGHT,
      videoUrl,
      youtubeUrl: youtubePipUrl,
      label,
    };
  });
  const assignedYoutubePipUrls = new Set(
    playerPips.flatMap((pip) => (pip.youtubeUrl ? [pip.youtubeUrl] : []))
  );
  const unassignedYoutubeUrls = validYoutubeUrls.filter(
    (url) => !assignedYoutubePipUrls.has(url)
  );
  const mainYoutubeRole = mainVideoSource.startsWith('youtube:')
    ? (mainVideoSource.slice('youtube:'.length) as ReturnType<
        typeof getYoutubePipVideoRole
      >)
    : undefined;
  const explicitMainYoutubeUrl = youtubeUrlForRole(mainYoutubeRole);
  const youtubeMainUrls =
    mainVideoSource === 'auto'
      ? unassignedYoutubeUrls.length
        ? unassignedYoutubeUrls
        : validYoutubeUrls
      : mainYoutubeRole && explicitMainYoutubeUrl
        ? [explicitMainYoutubeUrl]
        : [];
  const activeYoutubeIndex = youtubeMainUrls.length
    ? selectedYoutubeIndex % youtubeMainUrls.length
    : 0;
  const youtubeUrl = youtubeMainUrls[activeYoutubeIndex];
  const explicitMainFileUrl =
    mainVideoSource === 'file:face'
      ? faceUrl
      : mainVideoSource === 'file:pilote'
        ? piloteUrl
        : mainVideoSource === 'file:vol'
          ? flightUrl
          : undefined;
  const isExplicitFileMain = mainVideoSource.startsWith('file:');
  const mainCameraUrl = isExplicitFileMain
    ? (explicitMainFileUrl ?? '')
    : mainVideoSource.startsWith('youtube:') && !youtubeUrl
      ? ''
      : cameraUrl;
  const isMainSourceUnavailable =
    mainVideoSource !== 'auto' &&
    (isExplicitFileMain ? !explicitMainFileUrl : !youtubeUrl);
  const mainVideoLabel = mainVideoSource.endsWith(':face')
    ? t('flights.faceBadge')
    : mainVideoSource.endsWith(':pilote')
      ? t('flights.piloteBadge')
      : t('flights.goproOverlayFlightVideo');
  const activeYoutubeVideoId = getYoutubeVideoId(youtubeUrl ?? '');
  const activeVideoMarkers = videoMarkers.filter(
    (marker) => marker.youtube_video_id === activeYoutubeVideoId
  );
  const playablePips = playerPips.map((pip) => {
    if (!youtubeUrl || pip.youtubeUrl !== youtubeUrl) return pip;
    return Object.assign({}, pip, { youtubeUrl: undefined });
  });
  const exportPip =
    playablePips.find((pip) => pip.youtubeUrl) ?? playablePips[0];
  const pipLayout = exportPip;
  const youtubePipUrl = exportPip?.youtubeUrl;
  const pipOffsetSeconds = calibrationOffsetSeconds;
  const isYoutubeVideoAlreadyPublished = Boolean(
    youtubeAssociations.data?.some(
      (association) =>
        association.url === youtubeUrl &&
        association.can_delete_from_youtube &&
        association.exists_on_youtube === true
    )
  );
  const hasYoutubeCarousel = youtubeMainUrls.length > 1;
  useEffect(() => {
    setYoutubeExportJobId(readYoutubeExportJobId(flightId));
  }, [flightId]);
  useEffect(() => {
    if (
      youtubeExportJobId &&
      ['completed', 'failed', 'cancelled'].includes(
        youtubeExportStatus?.internal_status ??
          youtubeExportStatus?.status ??
          ''
      )
    ) {
      clearStoredYoutubeExportJobId(flightId, youtubeExportJobId);
    }
  }, [
    flightId,
    youtubeExportJobId,
    youtubeExportStatus?.internal_status,
    youtubeExportStatus?.status,
  ]);
  const selectYoutubeVideo = (index: number) => {
    if (youtubeMainUrls.length === 0) return;
    setSelectedYoutubeIndex(
      (index + youtubeMainUrls.length) % youtubeMainUrls.length
    );
    setCameraTime(0);
  };
  const youtubeExportStatusValue =
    youtubeExportStatus?.internal_status ?? youtubeExportStatus?.status;
  const youtubeExportProgress = Math.max(
    0,
    Math.min(100, youtubeExportStatus?.progress ?? 0)
  );
  useEffect(() => {
    if (
      !youtubeExportJobId ||
      youtubeExportStatusValue === 'completed' ||
      youtubeExportStatusValue === 'failed' ||
      youtubeExportStatusValue === 'cancelled'
    ) {
      return;
    }
    const timer = window.setInterval(
      () => setYoutubeExportNow(Date.now()),
      1000
    );
    return () => window.clearInterval(timer);
  }, [youtubeExportJobId, youtubeExportStatusValue]);
  const exportStartedAt = getTimestampMs(
    youtubeExportStatus?.started_at ?? youtubeExportStatus?.created_at
  );
  const exportFinishedAt = getTimestampMs(youtubeExportStatus?.completed_at);
  const exportUpdatedAt = getTimestampMs(youtubeExportStatus?.updated_at);
  const exportEndAt = exportFinishedAt ?? youtubeExportNow;
  const exportElapsedSeconds = exportStartedAt
    ? Math.max(0, (exportEndAt - exportStartedAt) / 1000)
    : null;
  const exportLastActivitySeconds = exportUpdatedAt
    ? Math.max(0, (youtubeExportNow - exportUpdatedAt) / 1000)
    : null;
  const isYoutubeExportActive =
    youtubeExportStatusValue === 'queued' ||
    youtubeExportStatusValue === 'running' ||
    youtubeExportStatusValue === 'processing' ||
    youtubeExportStatusValue === 'initializing' ||
    youtubeExportStatusValue === 'capturing' ||
    youtubeExportStatusValue === 'encoding';
  const isYoutubeExportBusy = startExport.isPending || isYoutubeExportActive;
  const shouldShowYoutubeExportProgress = Boolean(
    youtubeExportJobId &&
    (!isYoutubeOverlayPublished ||
      isYoutubeExportActive ||
      youtubeExportStatusValue === 'failed' ||
      youtubeExportStatusValue === 'cancelled' ||
      startExport.isPending ||
      youtubeOverlayUpload.isFetching)
  );
  const isYoutubeExportStalled =
    isYoutubeExportActive &&
    exportLastActivitySeconds !== null &&
    exportLastActivitySeconds * 1000 >= YOUTUBE_EXPORT_STALL_THRESHOLD_MS;
  const youtubeExportPhase = getYoutubeExportPhase(
    youtubeExportStatusValue,
    youtubeExportStatus?.message
  );
  const youtubeExportLastLog =
    (youtubeExportStatus?.log_tail?.length
      ? youtubeExportStatus.log_tail[youtubeExportStatus.log_tail.length - 1]
      : undefined) ?? youtubeExportStatus?.message;
  const youtubeExportRecentLogs =
    youtubeExportStatus?.log_tail?.slice(-3) ?? [];
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
        pip_apply_offset: pipLayout?.applyOffset !== false,
        ...(youtubePipUrl ? { pip_youtube_url: youtubePipUrl } : {}),
      });
      setYoutubeExportJobId(job_id);
      storeYoutubeExportJobId(flightId, job_id);
    } catch (error) {
      setYoutubeExportError(
        await getApiErrorMessage(error, t('flights.youtubeOverlayExportError'))
      );
    }
  };
  const youtubeDownloadNeedsCookies = [
    youtubeExportError,
    youtubeExportStatus?.error,
  ].some((error) => {
    const normalizedError = error?.toLowerCase() ?? '';
    return (
      normalizedError.includes('sign in to confirm') ||
      normalizedError.includes('http error 403: forbidden')
    );
  });
  const handleYoutubeCookieFile = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setCookieUploadMessage(null);
    setCookieUploadError(null);
    try {
      await uploadCookies.mutateAsync(file);
      setCookieUploadMessage(t('flights.youtubeCookiesSaved'));
    } catch (error) {
      setCookieUploadError(
        await getApiErrorMessage(error, t('flights.youtubeCookiesUploadError'))
      );
    } finally {
      input.value = '';
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
              variant={isYoutubeExportBusy ? 'cyan' : 'secondary'}
              isDisabled={isYoutubeExportBusy || isYoutubeVideoAlreadyPublished}
              aria-busy={isYoutubeExportBusy}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                isYoutubeExportBusy
                  ? 'border-cyan-400 disabled:opacity-100 dark:border-cyan-500'
                  : 'border-cyan-200 text-cyan-700 dark:border-cyan-800 dark:text-cyan-300'
              }`}
              onPress={launchYoutubeExport}
            >
              {isYoutubeExportBusy && (
                <LoaderCircle
                  className="h-3.5 w-3.5 motion-safe:animate-spin"
                  aria-hidden="true"
                />
              )}
              {isYoutubeExportBusy
                ? t('flights.youtubeOverlayExportInProgress')
                : isYoutubeVideoAlreadyPublished
                  ? t('flights.youtubeUploadPublished')
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
      {youtubeDownloadNeedsCookies && (
        <div className="border-t border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20 sm:px-5">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            {t('flights.youtubeCookiesRequired')}
          </p>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
            {t('flights.youtubeCookiesInstructions')}{' '}
            <a
              href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies"
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              {t('flights.youtubeCookiesHelpLink')}
            </a>
          </p>
          <input
            ref={cookieFileInput}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            aria-label={t('flights.youtubeCookiesFileLabel')}
            onChange={(event) => void handleYoutubeCookieFile(event)}
          />
          <Button
            variant="outline"
            className="mt-3"
            isDisabled={uploadCookies.isPending}
            onPress={() => cookieFileInput.current?.click()}
          >
            {uploadCookies.isPending ? (
              <LoaderCircle
                className="h-4 w-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {uploadCookies.isPending
              ? t('flights.youtubeCookiesUploading')
              : t('flights.youtubeCookiesUpload')}
          </Button>
          {cookieUploadMessage && (
            <output className="mt-2 block text-sm text-emerald-800 dark:text-emerald-200">
              {cookieUploadMessage}
            </output>
          )}
          {cookieUploadError && (
            <p
              className="mt-2 text-sm text-red-700 dark:text-red-300"
              role="alert"
            >
              {cookieUploadError}
            </p>
          )}
        </div>
      )}
      {shouldShowYoutubeExportProgress && (
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
          <div
            className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"
            aria-live="off"
          >
            <div className="rounded-lg border border-cyan-200/70 bg-white/60 px-2.5 py-2 dark:border-cyan-900/70 dark:bg-slate-950/20">
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                {t('flights.youtubeOverlayExportPhaseLabel', 'Étape')}
              </div>
              <div className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                {t(youtubeExportPhase.key, youtubeExportPhase.fallback)}
              </div>
            </div>
            <div className="rounded-lg border border-cyan-200/70 bg-white/60 px-2.5 py-2 dark:border-cyan-900/70 dark:bg-slate-950/20">
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('flights.youtubeOverlayExportElapsed', 'Durée')}
              </div>
              <div className="mt-1 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {formatDuration(exportElapsedSeconds)}
              </div>
            </div>
            <div className="rounded-lg border border-cyan-200/70 bg-white/60 px-2.5 py-2 dark:border-cyan-900/70 dark:bg-slate-950/20">
              <div className="text-slate-500 dark:text-slate-400">
                {t('flights.youtubeOverlayExportLastActivity', 'Activité')}
              </div>
              <div className="mt-1 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {formatAge(exportLastActivitySeconds, i18n?.language ?? 'fr')}
              </div>
            </div>
            <div className="rounded-lg border border-cyan-200/70 bg-white/60 px-2.5 py-2 dark:border-cyan-900/70 dark:bg-slate-950/20">
              <div className="text-slate-500 dark:text-slate-400">
                {t('flights.youtubeOverlayExportEta', 'Estimation')}
              </div>
              <div className="mt-1 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {formatEta(youtubeExportStatus?.eta_seconds) ??
                  t('flights.youtubeOverlayExportEtaUnknown', 'Non disponible')}
              </div>
            </div>
          </div>
          {youtubeExportStatus?.frames_captured != null &&
            youtubeExportStatus.total_frames != null && (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                {t(
                  'flights.youtubeOverlayExportFrames',
                  '{{captured}} / {{total}} images traitées',
                  {
                    captured: youtubeExportStatus.frames_captured,
                    total: youtubeExportStatus.total_frames,
                  }
                )}
              </p>
            )}
          {youtubeExportLastLog && (
            <p className="mt-2 truncate text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold">
                {t(
                  'flights.youtubeOverlayExportLatestEvent',
                  'Dernier événement'
                )}
                :
              </span>{' '}
              {youtubeExportLastLog}
            </p>
          )}
          {youtubeExportRecentLogs.length > 1 && (
            <details className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                {t(
                  'flights.youtubeOverlayExportShowLogs',
                  'Voir les derniers événements'
                )}
              </summary>
              <ul className="mt-2 space-y-1 rounded-lg bg-white/60 p-2 font-mono dark:bg-slate-950/20">
                {youtubeExportRecentLogs.map((log, index) => (
                  <li key={`${log}-${index}`} className="break-words">
                    {log}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {isYoutubeExportStalled && (
            <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {t(
                'flights.youtubeOverlayExportStalled',
                'Aucune mise à jour depuis {{minutes}} min. Le traitement est peut-être bloqué.',
                {
                  minutes: Math.max(
                    1,
                    Math.floor((exportLastActivitySeconds ?? 0) / 60)
                  ),
                }
              )}
            </p>
          )}
        </div>
      )}
      <div className="border-t border-slate-200 p-4 dark:border-slate-700 sm:p-5">
        {isLoading && (
          <output
            className="block rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-live="polite"
          >
            {t('flights.overlayInteractivePreviewLoading')}
            {isEnrichmentPending && (
              <span className="mt-1 block">
                {t('flights.goproOverlayEnrichmentPending')}
              </span>
            )}
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
                    total: youtubeMainUrls.length,
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
                key={youtubeUrl ?? mainCameraUrl ?? 'camera-only'}
                mode="interactive"
                cameraUrl={mainCameraUrl}
                flightUrl={flightUrl}
                youtubeUrl={youtubeUrl}
                videoMarkers={activeVideoMarkers}
                onAddVideoMarker={onAddVideoMarker}
                isSavingVideoMarker={isSavingVideoMarker}
                syncOffsetSeconds={calibrationOffsetSeconds}
                pipOffsetSeconds={pipOffsetSeconds}
                getFlightTime={(cameraTime) =>
                  cameraTime - calibrationOffsetSeconds
                }
                cameraLabel={
                  mainVideoSource === 'auto'
                    ? t('flights.goproOverlayCameraPreview')
                    : mainVideoLabel
                }
                flightLabel={t('flights.goproOverlayFlightVideo')}
                pips={playablePips}
                onTimeChange={(cameraTime) =>
                  setCameraTime(
                    youtubeUrl || isExplicitFileMain
                      ? cameraTime
                      : sourceTimeAtPreviewTime(cameraTime, previewSegments)
                  )
                }
                overlayContent={
                  isMainSourceUnavailable ? (
                    <div className="pointer-events-none flex h-full items-center justify-center p-6 text-center text-sm font-medium text-white">
                      {t('telemetryLayout.mainVideoUnavailable')}
                    </div>
                  ) : (
                    <FlightTelemetryOverlay
                      data={telemetry.data}
                      videoTimeSeconds={cameraTime}
                      offsetSeconds={calibrationOffsetSeconds}
                      timelineStartTimestamp={telemetryStartTimestamp}
                      layout={layout.data?.layout}
                    />
                  )
                }
              />
            </div>
          </div>
        )}
        {!isLoading && isEnrichmentFailed && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200"
          >
            <CircleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{t('flights.goproOverlayEnrichmentFailed')}</span>
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
