import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { FlightVideoMarker } from '@dashboard-parapente/shared-types';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Modal } from '@dashboard-parapente/design-system';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Edit3,
  LoaderCircle,
  Upload,
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
import {
  FlightOverlayPlayer,
  pipSyncOffsetSeconds,
} from './FlightOverlayPlayer';
import { FlightTelemetryOverlay } from './FlightTelemetryOverlay';
import {
  TELEMETRY_CANVAS_HEIGHT,
  TELEMETRY_CANVAS_WIDTH,
  getYoutubePipVideoRole,
  getYoutubeVideoRoleFromTitle,
  type FlightTelemetryPipLayout,
  type TelemetryPipVideoRole,
} from './flightTelemetryLayout';
import { sourceTimeAtPreviewTime } from './GoproOverlaySyncPreview';
import { getYoutubeVideoId } from '../../../lib/youtube';
import {
  useUploadYoutubeDownloadCookies,
  useYoutubeUpload,
  useYoutubeVideoAssociations,
  useStartYoutubeTelemetryLayoutExport,
} from '../../../hooks/flights/useYoutubeUpload';

interface FlightTelemetryInteractivePreviewProps {
  flightId: string;
  activeYoutubeExportJobIds?: string[];
  hasFlightVideo?: boolean;
  hasFaceVideo?: boolean;
  hasPiloteVideo?: boolean;
  manualOffsetSeconds?: number;
  youtubeUrls?: string[];
  videoMarkers?: FlightVideoMarker[];
  onCurrentYoutubePositionChange?: (
    position: { videoId: string; seconds: number } | null
  ) => void;
}

const EMPTY_YOUTUBE_URLS: string[] = [];
const EMPTY_VIDEO_MARKERS: FlightVideoMarker[] = [];
const EMPTY_YOUTUBE_EXPORT_JOB_IDS: string[] = [];
const YOUTUBE_COOKIE_NOTICE_DURATION_MS = 10_000;

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
    // Keep tracking the job in memory when browser storage is unavailable.
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
    // Keep showing the current job when browser storage is unavailable.
  }
}

export function FlightTelemetryInteractivePreview({
  flightId,
  activeYoutubeExportJobIds = EMPTY_YOUTUBE_EXPORT_JOB_IDS,
  hasFlightVideo = true,
  hasFaceVideo = false,
  hasPiloteVideo = false,
  manualOffsetSeconds,
  youtubeUrls = EMPTY_YOUTUBE_URLS,
  videoMarkers = EMPTY_VIDEO_MARKERS,
  onCurrentYoutubePositionChange,
}: FlightTelemetryInteractivePreviewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const overlayPreview = useGoproOverlayPreview(flightId, true);
  const telemetry = useFlightTelemetry(flightId, true);
  const layout = useTelemetryLayout(flightId);
  const [cameraTime, setCameraTime] = useState(0);
  const [youtubeExportJobId, setYoutubeExportJobId] = useState(() =>
    readYoutubeExportJobId(flightId)
  );
  const [isYoutubeExportDialogOpen, setIsYoutubeExportDialogOpen] =
    useState(false);
  const [youtubeExportStartError, setYoutubeExportStartError] = useState<
    string | null
  >(null);
  const [youtubeExportFailure, setYoutubeExportFailure] = useState<{
    flightId: string;
    jobId: string;
    message: string;
  } | null>(null);
  const startYoutubeTelemetryExport =
    useStartYoutubeTelemetryLayoutExport(flightId);
  const youtubeAssociations = useYoutubeVideoAssociations(flightId);
  const youtubeTelemetryUpload = useYoutubeUpload(flightId, {
    source_type: 'youtube_telemetry',
  });
  const publishedTelemetryUrl = youtubeTelemetryUpload.data?.youtube_url;
  const uploadCookies = useUploadYoutubeDownloadCookies();
  const clearedYoutubeExportJobIds = useRef(new Set<string>());
  const cookieFileInput = useRef<HTMLInputElement>(null);
  const [cookieUploadMessage, setCookieUploadMessage] = useState<string | null>(
    null
  );
  const [cookieUploadError, setCookieUploadError] = useState<string | null>(
    null
  );
  const { status: youtubeExportStatus, error: youtubeExportStatusError } =
    useVideoExportStatus(youtubeExportJobId);
  useEffect(() => {
    if (
      youtubeExportStatus?.internal_status !== 'completed' &&
      youtubeExportStatus?.status !== 'completed'
    ) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ['flights'] });
    void queryClient.invalidateQueries({ queryKey: ['flights', flightId] });
  }, [
    flightId,
    queryClient,
    youtubeExportStatus?.internal_status,
    youtubeExportStatus?.status,
  ]);
  useEffect(() => {
    const activeJobIds = new Set(activeYoutubeExportJobIds);
    for (const jobId of clearedYoutubeExportJobIds.current) {
      if (!activeJobIds.has(jobId)) {
        clearedYoutubeExportJobIds.current.delete(jobId);
      }
    }
    const activeYoutubeExportJobId =
      (youtubeExportJobId &&
      activeJobIds.has(youtubeExportJobId) &&
      !clearedYoutubeExportJobIds.current.has(youtubeExportJobId)
        ? youtubeExportJobId
        : activeYoutubeExportJobIds.find(
            (jobId) => !clearedYoutubeExportJobIds.current.has(jobId)
          )) ?? null;
    if (
      !activeYoutubeExportJobId ||
      activeYoutubeExportJobId === youtubeExportJobId
    ) {
      return;
    }
    storeYoutubeExportJobId(flightId, activeYoutubeExportJobId);
    setYoutubeExportJobId(activeYoutubeExportJobId);
  }, [activeYoutubeExportJobIds, flightId, youtubeExportJobId]);
  const validYoutubeUrls = youtubeUrls.filter((url) => getYoutubeVideoId(url));
  const validYoutubeMainUrls = youtubeAssociations.isSuccess
    ? validYoutubeUrls.filter((url) => {
        if (url === publishedTelemetryUrl) return false;
        const title = youtubeAssociations.data.find(
          (association) => association.url === url
        )?.title;
        return !/(?:^|[\s:–—-])(?:télémétrie|telemetry)(?:\s+(?:overlay|video))?\s*$/iu.test(
          title ?? ''
        );
      })
    : [];
  const configuredMainVideoSource =
    layout.data?.layout.mainVideoSource ?? 'auto';
  const [selectedYoutubeIndex, setSelectedYoutubeIndex] = useState(0);
  const isEnrichmentPending =
    telemetry.data?.enrichment_status === 'pending' ||
    overlayPreview.data?.gpx?.enrichment_status === 'pending';
  const isEnrichmentFailed =
    telemetry.data?.enrichment_status === 'failed' ||
    overlayPreview.data?.gpx?.enrichment_status === 'failed';
  const enrichmentProgress =
    telemetry.data?.enrichment_progress ??
    overlayPreview.data?.gpx?.enrichment_progress ??
    null;
  const isLoading =
    telemetry.isPending ||
    overlayPreview.isPending ||
    layout.isPending ||
    isEnrichmentPending;
  const isSelectedLocalMainAvailable =
    (configuredMainVideoSource === 'file:face' && hasFaceVideo) ||
    (configuredMainVideoSource === 'file:pilote' && hasPiloteVideo) ||
    (configuredMainVideoSource === 'file:vol' && hasFlightVideo);
  const isReady =
    telemetry.isSuccess &&
    layout.isSuccess &&
    (overlayPreview.isSuccess ||
      validYoutubeMainUrls.length > 0 ||
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
            validYoutubeMainUrls.includes(association.url) &&
            getYoutubeVideoRoleFromTitle(association.title) === role
        )?.url
      : undefined;
  const configuredYoutubeRole = configuredMainVideoSource.startsWith('youtube:')
    ? (configuredMainVideoSource.slice('youtube:'.length) as ReturnType<
        typeof getYoutubePipVideoRole
      >)
    : undefined;
  const isConfiguredMainSourceAvailable =
    configuredMainVideoSource === 'auto' ||
    isSelectedLocalMainAvailable ||
    Boolean(youtubeUrlForRole(configuredYoutubeRole));
  const mainVideoSource = isConfiguredMainSourceAvailable
    ? configuredMainVideoSource
    : 'auto';
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
    return Object.assign({}, pip, {
      x: pip.x / TELEMETRY_CANVAS_WIDTH,
      y: pip.y / TELEMETRY_CANVAS_HEIGHT,
      width: pip.width / TELEMETRY_CANVAS_WIDTH,
      height: pip.height / TELEMETRY_CANVAS_HEIGHT,
      videoUrl,
      youtubeUrl: youtubePipUrl,
      label,
    });
  });
  const assignedYoutubePipUrls = new Set(
    playerPips.flatMap((pip) => (pip.youtubeUrl ? [pip.youtubeUrl] : []))
  );
  const unassignedYoutubeUrls = validYoutubeMainUrls.filter(
    (url) => !assignedYoutubePipUrls.has(url)
  );
  const mainYoutubeRole = mainVideoSource.startsWith('youtube:')
    ? (mainVideoSource.slice('youtube:'.length) as ReturnType<
        typeof getYoutubePipVideoRole
      >)
    : undefined;
  const explicitMainYoutubeUrl = youtubeUrlForRole(mainYoutubeRole);
  let youtubeMainUrls: string[];
  if (mainVideoSource === 'auto') {
    youtubeMainUrls = unassignedYoutubeUrls.length
      ? unassignedYoutubeUrls
      : validYoutubeMainUrls;
  } else if (mainYoutubeRole && explicitMainYoutubeUrl) {
    youtubeMainUrls = [explicitMainYoutubeUrl];
  } else {
    youtubeMainUrls = [];
  }
  const activeYoutubeIndex = youtubeMainUrls.length
    ? selectedYoutubeIndex % youtubeMainUrls.length
    : 0;
  const youtubeUrl = youtubeMainUrls[activeYoutubeIndex];
  const activeYoutubeVideoId = youtubeUrl
    ? getYoutubeVideoId(youtubeUrl)
    : null;
  const activeYoutubeRole = youtubeUrl
    ? getYoutubeVideoRoleFromTitle(
        youtubeAssociations.data?.find(
          (association) => association.url === youtubeUrl
        )?.title
      )
    : undefined;
  let mainVideoRole: TelemetryPipVideoRole;
  if (mainVideoSource === 'auto') {
    mainVideoRole = youtubeUrl ? (activeYoutubeRole ?? 'face') : 'vol';
  } else {
    mainVideoRole = mainVideoSource.split(':')[1] as TelemetryPipVideoRole;
  }
  let explicitMainFileUrl: string | undefined;
  if (mainVideoSource === 'file:face') explicitMainFileUrl = faceUrl;
  else if (mainVideoSource === 'file:pilote') explicitMainFileUrl = piloteUrl;
  else if (mainVideoSource === 'file:vol') explicitMainFileUrl = flightUrl;
  const isExplicitFileMain = mainVideoSource.startsWith('file:');
  let mainCameraUrl = cameraUrl;
  if (isExplicitFileMain) mainCameraUrl = explicitMainFileUrl ?? '';
  else if (mainVideoSource.startsWith('youtube:') && !youtubeUrl) {
    mainCameraUrl = '';
  }
  let isMainSourceUnavailable = false;
  if (mainVideoSource !== 'auto') {
    isMainSourceUnavailable = isExplicitFileMain
      ? !explicitMainFileUrl
      : !youtubeUrl;
  }
  let mainVideoLabel = t('flights.goproOverlayFlightVideo');
  if (mainVideoSource.endsWith(':face'))
    mainVideoLabel = t('flights.faceBadge');
  else if (mainVideoSource.endsWith(':pilote')) {
    mainVideoLabel = t('flights.piloteBadge');
  }
  // Flight markers share one source-video timeline across associated videos.
  // The existing overlay offset continues to align the GPX track separately.
  const activeVideoMarkers = videoMarkers;
  const playablePips = playerPips.map((pip) =>
    !youtubeUrl || pip.youtubeUrl !== youtubeUrl
      ? pip
      : Object.assign({}, pip, { youtubeUrl: undefined })
  );
  const pipOffsetSeconds = calibrationOffsetSeconds;
  const hasYoutubeCarousel = youtubeMainUrls.length > 1;
  useEffect(() => {
    setYoutubeExportJobId(readYoutubeExportJobId(flightId));
  }, [flightId]);
  const selectYoutubeVideo = (index: number) => {
    if (youtubeMainUrls.length === 0) return;
    setSelectedYoutubeIndex(
      (index + youtubeMainUrls.length) % youtubeMainUrls.length
    );
    setCameraTime(0);
  };
  const handleStartYoutubeLayoutExport = async () => {
    if (!youtubeUrl) return;
    setYoutubeCookieNoticeAttempt((attempt) => attempt + 1);
    setYoutubeExportStartError(null);
    setYoutubeExportFailure(null);
    try {
      const youtubePips = playablePips.filter(
        (pip) =>
          pip.youtubeUrl &&
          pip.youtubeUrl !== youtubeUrl &&
          pip.source?.startsWith('youtube:')
      );
      const job = await startYoutubeTelemetryExport.mutateAsync({
        youtube_url: youtubeUrl,
        offset_seconds: calibrationOffsetSeconds,
        pip_exports: youtubePips.flatMap((pip) =>
          pip.youtubeUrl && pip.source
            ? [
                {
                  slot_id: pip.id,
                  source: pip.source,
                  youtube_url: pip.youtubeUrl,
                  offset_seconds: pipSyncOffsetSeconds(
                    pip,
                    mainVideoRole,
                    calibrationOffsetSeconds
                  ),
                },
              ]
            : []
        ),
      });
      try {
        window.sessionStorage.setItem(
          youtubeExportJobStorageKey(flightId),
          job.job_id
        );
      } catch {
        // Keep tracking the job in memory when browser storage is unavailable.
      }
      setYoutubeExportJobId(job.job_id);
      setIsYoutubeExportDialogOpen(false);
    } catch (error) {
      setYoutubeExportStartError(
        await getApiErrorMessage(error, t('flights.youtubeOverlayExportError'))
      );
    }
  };
  const youtubeExportStatusValue =
    youtubeExportStatus?.internal_status ?? youtubeExportStatus?.status;
  const isYoutubeExportTerminal = ['completed', 'failed', 'cancelled'].includes(
    youtubeExportStatusValue ?? ''
  );
  const isYoutubeExportActive = Boolean(
    !isYoutubeExportTerminal &&
    ((youtubeExportJobId &&
      activeYoutubeExportJobIds.includes(youtubeExportJobId)) ||
      youtubeExportStatusValue === 'queued' ||
      youtubeExportStatusValue === 'running' ||
      youtubeExportStatusValue === 'processing' ||
      youtubeExportStatusValue === 'initializing' ||
      youtubeExportStatusValue === 'capturing' ||
      youtubeExportStatusValue === 'encoding')
  );
  const youtubeExportProgress =
    typeof youtubeExportStatus?.progress === 'number' &&
    Number.isFinite(youtubeExportStatus.progress)
      ? Math.min(100, Math.max(0, Math.round(youtubeExportStatus.progress)))
      : null;
  const isYoutubeCookieError = (errorText: string) => {
    const normalizedError = errorText.toLowerCase();
    return (
      normalizedError.includes('sign in to confirm') ||
      normalizedError.includes('cookie') ||
      normalizedError.includes('http error 403: forbidden')
    );
  };
  const youtubeDownloadNeedsCookies = youtubeExportStartError
    ? isYoutubeCookieError(youtubeExportStartError)
    : youtubeExportStatusValue === 'failed' &&
      isYoutubeCookieError(
        [
          youtubeExportStatus?.error,
          youtubeExportStatus?.message,
          ...(youtubeExportStatus?.log_tail ?? []),
        ]
          .filter(Boolean)
          .join('\n')
      );
  const [showYoutubeCookieNotice, setShowYoutubeCookieNotice] = useState(true);
  const [youtubeCookieNoticeAttempt, setYoutubeCookieNoticeAttempt] =
    useState(0);
  useEffect(() => {
    if (!youtubeDownloadNeedsCookies) {
      setShowYoutubeCookieNotice(true);
      return;
    }

    setShowYoutubeCookieNotice(true);
    const timeoutId = window.setTimeout(
      () => setShowYoutubeCookieNotice(false),
      YOUTUBE_COOKIE_NOTICE_DURATION_MS
    );
    return () => window.clearTimeout(timeoutId);
  }, [youtubeCookieNoticeAttempt, youtubeDownloadNeedsCookies]);
  const isYoutubeCookieNoticeVisible =
    youtubeDownloadNeedsCookies && showYoutubeCookieNotice;
  useEffect(() => {
    if (youtubeExportStatusValue !== 'failed' || youtubeDownloadNeedsCookies) {
      return;
    }
    setYoutubeExportFailure({
      flightId,
      jobId: youtubeExportJobId ?? '',
      message:
        youtubeExportStatus?.error ||
        youtubeExportStatus?.message ||
        t('flights.youtubeOverlayExportFailed'),
    });
  }, [
    flightId,
    t,
    youtubeDownloadNeedsCookies,
    youtubeExportJobId,
    youtubeExportStatus?.error,
    youtubeExportStatus?.message,
    youtubeExportStatusValue,
  ]);
  useEffect(() => {
    if (
      youtubeExportJobId &&
      ['completed', 'failed', 'cancelled'].includes(
        youtubeExportStatusValue ?? ''
      ) &&
      !youtubeDownloadNeedsCookies
    ) {
      clearedYoutubeExportJobIds.current.add(youtubeExportJobId);
      clearStoredYoutubeExportJobId(flightId, youtubeExportJobId);
      setYoutubeExportJobId(null);
    }
  }, [
    flightId,
    youtubeExportJobId,
    youtubeExportStatusValue,
    youtubeDownloadNeedsCookies,
  ]);
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
        </span>
      </div>
      {youtubeExportFailure?.flightId === flightId &&
        (!youtubeExportJobId ||
          youtubeExportFailure.jobId === youtubeExportJobId) && (
          <p
            role="alert"
            className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 sm:px-5"
          >
            {youtubeExportFailure.message}
          </p>
        )}
      {validYoutubeUrls.length > 0 && (
        <div
          className={
            isYoutubeCookieNoticeVisible
              ? 'border-t border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20 sm:px-5'
              : 'border-t border-slate-200 p-4 dark:border-slate-700 sm:px-5'
          }
        >
          {isYoutubeCookieNoticeVisible && (
            <>
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
            </>
          )}
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
      <div className="border-t border-slate-200 p-4 dark:border-slate-700 sm:p-5">
        {isLoading && (
          <output
            className="block rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-live="polite"
          >
            {t('flights.overlayInteractivePreviewLoading')}
            {isEnrichmentPending && (
              <div className="mt-2">
                <span className="block">
                  {t('flights.goproOverlayEnrichmentPending')}
                </span>
                <div className="mt-2 flex items-center gap-3">
                  <progress
                    aria-label={t(
                      'flights.goproOverlayEnrichmentProgressLabel'
                    )}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={enrichmentProgress ?? undefined}
                    value={enrichmentProgress ?? undefined}
                    max={100}
                    className="h-2 min-w-0 flex-1 accent-blue-600 dark:accent-blue-400"
                  />
                  {enrichmentProgress != null && (
                    <span className="min-w-10 text-right text-xs font-semibold tabular-nums text-blue-800 dark:text-blue-200">
                      {enrichmentProgress}%
                    </span>
                  )}
                </div>
              </div>
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
              {youtubeUrl && (
                <div className="mb-3 flex flex-col items-end gap-2">
                  <Button
                    variant="outline"
                    isDisabled={
                      isYoutubeExportActive ||
                      startYoutubeTelemetryExport.isPending
                    }
                    onPress={() => {
                      setYoutubeExportStartError(null);
                      setIsYoutubeExportDialogOpen(true);
                    }}
                  >
                    {!isYoutubeExportActive && (
                      <Upload className="h-4 w-4" aria-hidden="true" />
                    )}
                    {isYoutubeExportActive ? (
                      <>
                        {t('flights.youtubeOverlayExportInProgress')}
                        {youtubeExportProgress != null && (
                          <span> {youtubeExportProgress}%</span>
                        )}
                      </>
                    ) : (
                      t('flights.youtubeOverlayExport')
                    )}
                  </Button>
                  {(isYoutubeExportActive ||
                    (youtubeExportJobId && !isYoutubeExportTerminal)) &&
                    youtubeExportStatusError && (
                      <p
                        role="alert"
                        className="text-right text-sm text-amber-800 dark:text-amber-200"
                      >
                        {t('flights.youtubeOverlayExportStatusError')}
                      </p>
                    )}
                </div>
              )}
              <FlightOverlayPlayer
                key={youtubeUrl ?? mainCameraUrl ?? 'camera-only'}
                mode="interactive"
                cameraUrl={mainCameraUrl}
                flightUrl={flightUrl}
                youtubeUrl={youtubeUrl}
                mainVideoRole={mainVideoRole}
                videoMarkers={activeVideoMarkers}
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
                onTimeChange={(cameraTime) => {
                  if (youtubeUrl && activeYoutubeVideoId) {
                    onCurrentYoutubePositionChange?.({
                      videoId: activeYoutubeVideoId,
                      seconds: Math.max(0, Math.floor(cameraTime)),
                    });
                  } else {
                    onCurrentYoutubePositionChange?.(null);
                  }
                  setCameraTime(
                    youtubeUrl || isExplicitFileMain
                      ? cameraTime
                      : sourceTimeAtPreviewTime(cameraTime, previewSegments)
                  );
                }}
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
        <Modal
          isOpen={isYoutubeExportDialogOpen}
          onClose={() => setIsYoutubeExportDialogOpen(false)}
          title={t('flights.youtubeOverlayExportTitle')}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t('flights.youtubeOverlayExportDescription')}
            </p>
            {youtubeExportStartError && (
              <p
                role="alert"
                className="text-sm text-red-700 dark:text-red-300"
              >
                {youtubeExportStartError}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                isDisabled={startYoutubeTelemetryExport.isPending}
                onPress={() => void handleStartYoutubeLayoutExport()}
              >
                {startYoutubeTelemetryExport.isPending ? (
                  <LoaderCircle
                    className="h-4 w-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                {t('flights.youtubeOverlayExportStart')}
              </Button>
            </div>
          </div>
        </Modal>
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
