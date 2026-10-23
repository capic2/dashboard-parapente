import {
  VIDEO_EXPORT_IN_PROGRESS_STATUSES,
  type BackgroundOperation,
  type HighlightVideoJob,
} from '@dashboard-parapente/shared-types';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseApiUtcDate } from '../../../lib/date';
import type { VideoExportStatusPayload } from '../../../hooks/flights/useVideoExportStatus';
import type { YoutubeUploadJob } from '../../../hooks/flights/useYoutubeUpload';
import type { GoproOverlayJob } from '../../../hooks/gopro/useGoproOverlay';
import type { VideoExportJob } from '../../../hooks/flights/useVideoExportJobs';
import {
  isGoproOverlayInProgress,
  isYoutubeUploadProgressVisible,
} from '../../../lib/flightMediaState';
import { JobLogViewer } from '../job-logs/JobLogViewer';
import { YoutubeTelemetryExportDetails } from '../video-export/VideoExportJobsPanel';
import { OperationTimeline } from '../../common/OperationTimeline';

type FlightGenerationLogsPanelProps = {
  videoJobId?: string | null;
  videoStatus: VideoExportStatusPayload | null;
  videoFallbackStatus?: string | null;
  videoFallbackProgress?: number | null;
  goproOverlayJob: GoproOverlayJob | null;
  overlayLayerJob?: GoproOverlayJob | null;
  goproOverlayJobId?: string | null;
  goproOverlayFallbackStatus?: string | null;
  goproOverlayFallbackProgress?: number | null;
  youtubeTelemetryExportJobId?: string | null;
  youtubeTelemetryExportStatus?: string | null;
  youtubeTelemetryExportProgress?: number | null;
  youtubeUploadJob: YoutubeUploadJob | null;
  highlightVideo: HighlightVideoJob | null;
  gpxEnrichmentOperations?: BackgroundOperation[];
};

type LogSourceCardProps = {
  title: string;
  renderMethod?: string | null;
  status: string | null;
  statusLabel: string | null;
  isInProgress: boolean;
  progress?: number | null;
  message?: string | null;
  error?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
  logs?: string[] | null;
};

const STALLED_JOB_THRESHOLD_MS = 5 * 60 * 1000;

function getStalledJobMinutes(
  status: string | null,
  updatedAt?: string | null,
  now = Date.now()
): number | null {
  if (
    !status ||
    ['queued', 'cancelled', 'completed', 'failed'].includes(status)
  ) {
    return null;
  }
  if (!updatedAt) return null;
  const lastActivity = parseApiUtcDate(updatedAt).getTime();
  if (!Number.isFinite(lastActivity)) return null;
  const elapsedMs = now - lastActivity;
  if (elapsedMs < STALLED_JOB_THRESHOLD_MS) return null;
  const minutes = Math.max(1, Math.floor(elapsedMs / 60000));
  return minutes;
}

function clampProgress(progress?: number | null) {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(progress)));
}

function getStatusTone(status: string | null) {
  if (status === 'failed') {
    return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100';
  }

  if (status === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100';
  }

  if (status === 'cancelled') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100';
  }

  return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100';
}

function LogSourceCard({
  title,
  renderMethod,
  status,
  statusLabel,
  isInProgress,
  progress,
  message,
  error,
  createdAt,
  startedAt,
  completedAt,
  updatedAt,
  logs,
}: LogSourceCardProps) {
  const { t, i18n } = useTranslation();
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const isOpen = openOverride ?? isInProgress;
  const lines = logs?.filter(Boolean) ?? [];
  const normalizedProgress = clampProgress(progress);
  const showIndeterminateProgress = isInProgress && normalizedProgress === 0;
  const hasDetails = Boolean(message || error || lines.length > 0);
  const statusTone = getStatusTone(status);
  const showCurrentMessage = Boolean(
    message && !lines.some((line) => line.includes(message))
  );
  const isLive = Boolean(
    status && !['cancelled', 'completed', 'failed'].includes(status)
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isLive) return;

    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [isLive]);

  const stalledJobMinutes = getStalledJobMinutes(status, updatedAt, now);
  const durationStart = startedAt || createdAt;
  const durationStartMs = durationStart
    ? parseApiUtcDate(durationStart).getTime()
    : Number.NaN;
  let durationEndMs = now;
  if (completedAt) {
    durationEndMs = parseApiUtcDate(completedAt).getTime();
  } else if (updatedAt && !isLive) {
    durationEndMs = parseApiUtcDate(updatedAt).getTime();
  }
  const durationSeconds =
    Number.isFinite(durationStartMs) && Number.isFinite(durationEndMs)
      ? Math.max(0, Math.floor((durationEndMs - durationStartMs) / 1000))
      : null;
  const activityMs = updatedAt
    ? parseApiUtcDate(updatedAt).getTime()
    : Number.NaN;
  const activityAge = Number.isFinite(activityMs)
    ? new Intl.RelativeTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        numeric: 'auto',
        style: 'short',
      }).format(-Math.max(0, Math.floor((now - activityMs) / 60_000)), 'minute')
    : null;
  const formatElapsed = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours} h ${minutes % 60} min`;
    if (minutes > 0) return `${minutes} min`;
    return `${seconds} s`;
  };
  const renderMethodLabel =
    renderMethod && ['cpu', 'gpu'].includes(renderMethod)
      ? t(`flights.generationLogs.method.${renderMethod}`)
      : null;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
        aria-expanded={isOpen}
        onClick={() => setOpenOverride(!isOpen)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h4>
            {renderMethodLabel && (
              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {renderMethodLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusLabel && (
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone}`}
            >
              {statusLabel}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={`size-4 text-slate-500 transition-transform dark:text-slate-400 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 p-3 dark:border-slate-700">
          {showCurrentMessage && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {message}
            </p>
          )}

          {(normalizedProgress !== null || showIndeterminateProgress) && (
            <div
              className="mt-3"
              aria-label={t('flights.generationLogs.progress')}
            >
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>{t('flights.generationLogs.progress')}</span>
                <span>
                  {showIndeterminateProgress
                    ? statusLabel
                    : `${normalizedProgress}%`}
                </span>
              </div>
              <progress
                className="block h-2 w-full overflow-hidden rounded-full bg-slate-200 accent-sky-500 dark:bg-slate-800"
                aria-label={t('flights.generationLogs.progress')}
                aria-valuetext={
                  showIndeterminateProgress
                    ? (statusLabel ?? undefined)
                    : `${normalizedProgress}%`
                }
                value={
                  showIndeterminateProgress
                    ? undefined
                    : (normalizedProgress ?? undefined)
                }
                max={100}
              >
                {showIndeterminateProgress
                  ? statusLabel
                  : `${normalizedProgress}%`}
              </progress>
            </div>
          )}

          {(durationSeconds !== null || activityAge) && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {durationSeconds !== null && (
                <div className="rounded-md border border-slate-200 px-2.5 py-2 dark:border-slate-700">
                  <dt className="text-slate-500 dark:text-slate-400">
                    {t('flights.generationLogs.elapsed', 'Durée')}
                  </dt>
                  <dd className="mt-1 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {formatElapsed(durationSeconds)}
                  </dd>
                </div>
              )}
              {activityAge && (
                <div className="rounded-md border border-slate-200 px-2.5 py-2 dark:border-slate-700">
                  <dt className="text-slate-500 dark:text-slate-400">
                    {t('flights.generationLogs.lastActivity', 'Activité')}
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                    {activityAge}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-950 p-2 text-xs text-red-50 dark:border-red-900">
              <div className="mb-1 font-semibold">
                {t('flights.generationLogs.error')}
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
                {error}
              </pre>
            </div>
          )}

          {stalledJobMinutes && !error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
              {t('flights.generationLogs.stalled', {
                minutes: stalledJobMinutes,
              })}
            </div>
          )}

          <div className="mt-3">
            <JobLogViewer
              logs={lines}
              isLive={isLive}
              emptyLabel={
                hasDetails
                  ? t('flights.generationLogs.noRawLogs')
                  : t('flights.generationLogs.noLogs')
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}

export function FlightGenerationLogsPanel({
  videoJobId,
  videoStatus,
  videoFallbackStatus,
  videoFallbackProgress,
  goproOverlayJob,
  overlayLayerJob,
  goproOverlayJobId,
  goproOverlayFallbackStatus,
  goproOverlayFallbackProgress,
  youtubeTelemetryExportJobId,
  youtubeTelemetryExportStatus,
  youtubeTelemetryExportProgress,
  youtubeUploadJob,
  highlightVideo,
  gpxEnrichmentOperations = [],
}: FlightGenerationLogsPanelProps) {
  const { t } = useTranslation();
  const videoStatusValue =
    videoStatus?.internal_status ??
    videoStatus?.status ??
    videoFallbackStatus ??
    null;
  const goproOverlayStatusValue =
    goproOverlayJob?.status ?? goproOverlayFallbackStatus ?? null;
  const hasVideoLogSource = Boolean(
    videoStatusValue || videoStatus?.job_id || videoJobId
  );
  const hasGoproOverlayLogSource = Boolean(
    goproOverlayStatusValue || goproOverlayJob?.job_id || goproOverlayJobId
  );
  const hasOverlayLayerLogSource = Boolean(overlayLayerJob?.job_id);
  const hasYoutubeUploadLogSource = Boolean(
    youtubeUploadJob?.job_id && isYoutubeUploadProgressVisible(youtubeUploadJob)
  );
  const hasHighlightLogSource = Boolean(highlightVideo?.job_id);
  const hasYoutubeTelemetryExport = Boolean(youtubeTelemetryExportJobId);

  if (
    !hasVideoLogSource &&
    !hasGoproOverlayLogSource &&
    !hasOverlayLayerLogSource &&
    !hasYoutubeUploadLogSource &&
    !hasHighlightLogSource &&
    !hasYoutubeTelemetryExport &&
    gpxEnrichmentOperations.length === 0
  ) {
    return null;
  }

  const telemetryExportJob: VideoExportJob | null = youtubeTelemetryExportJobId
    ? {
        job_id: youtubeTelemetryExportJobId,
        mode: 'youtube_telemetry_layout',
        status: youtubeTelemetryExportStatus ?? 'running',
        internal_status: youtubeTelemetryExportStatus ?? 'running',
        progress: youtubeTelemetryExportProgress,
        can_cancel: false,
        can_delete: false,
      }
    : null;

  return (
    <>
      {telemetryExportJob && (
        <section
          aria-labelledby="youtube-telemetry-progress-heading"
          className="my-4 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/40"
        >
          <h3
            id="youtube-telemetry-progress-heading"
            className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100"
          >
            {t(
              'flights.generationLogs.exportProgressSectionTitle',
              'Progression de l’export'
            )}
          </h3>
          <YoutubeTelemetryExportDetails job={telemetryExportJob} />
        </section>
      )}
      <div className="my-4 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {t('flights.generationLogs.title')}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {t('flights.generationLogs.description')}
          </p>
        </div>
        <div className="space-y-3">
          {gpxEnrichmentOperations.map((operation) => (
            <section
              key={operation.operation_id}
              aria-label={t(operation.title_key, operation.operation_type)}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t(operation.title_key, operation.operation_type)}
                </h4>
                <span className="shrink-0 text-xs text-slate-600 dark:text-slate-300">
                  {t(`operations.status.${operation.status}`, operation.status)}
                </span>
              </div>
              <OperationTimeline operation={operation} />
            </section>
          ))}
          {hasOverlayLayerLogSource && overlayLayerJob && (
            <LogSourceCard
              key={`overlay-layer-${overlayLayerJob.job_id}`}
              title={t(
                'flights.generationLogs.overlayLayerTitle',
                'Couche overlay'
              )}
              status={overlayLayerJob.status}
              isInProgress={isGoproOverlayInProgress(overlayLayerJob.status)}
              statusLabel={t(
                `flights.generationLogs.status.${overlayLayerJob.status}`
              )}
              progress={overlayLayerJob.progress}
              message={overlayLayerJob.message}
              error={overlayLayerJob.error}
              updatedAt={overlayLayerJob.updated_at}
              logs={overlayLayerJob.log_tail}
            />
          )}
          {hasVideoLogSource && (
            <LogSourceCard
              key={`video-${videoStatus?.job_id ?? videoJobId ?? 'fallback'}`}
              title={t('flights.generationLogs.videoTitle')}
              renderMethod={videoStatus?.render_method ?? null}
              status={videoStatusValue}
              isInProgress={Boolean(
                videoStatusValue &&
                VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(videoStatusValue)
              )}
              statusLabel={
                videoStatusValue
                  ? t(`flights.generationLogs.status.${videoStatusValue}`)
                  : null
              }
              progress={videoStatus?.progress ?? videoFallbackProgress}
              message={videoStatus?.message}
              error={videoStatus?.error}
              createdAt={videoStatus?.created_at}
              startedAt={videoStatus?.started_at}
              completedAt={videoStatus?.completed_at}
              updatedAt={videoStatus?.updated_at}
              logs={videoStatus?.log_tail}
            />
          )}
          {hasGoproOverlayLogSource && (
            <LogSourceCard
              key={`gopro-${goproOverlayJob?.job_id ?? goproOverlayJobId ?? 'fallback'}`}
              title={t('flights.generationLogs.goproOverlayTitle')}
              renderMethod={
                goproOverlayJob &&
                ['running', 'completed', 'failed', 'cancelled'].includes(
                  goproOverlayJob.status
                )
                  ? (goproOverlayJob.render_method ?? null)
                  : null
              }
              status={goproOverlayStatusValue}
              isInProgress={isGoproOverlayInProgress(goproOverlayStatusValue)}
              statusLabel={
                goproOverlayStatusValue
                  ? t(
                      `flights.generationLogs.status.${goproOverlayStatusValue}`
                    )
                  : null
              }
              progress={
                goproOverlayJob?.progress ?? goproOverlayFallbackProgress
              }
              message={goproOverlayJob?.message}
              error={goproOverlayJob?.error}
              createdAt={goproOverlayJob?.created_at}
              completedAt={goproOverlayJob?.completed_at}
              updatedAt={goproOverlayJob?.updated_at}
              logs={goproOverlayJob?.log_tail}
            />
          )}
          {hasYoutubeUploadLogSource && youtubeUploadJob && (
            <LogSourceCard
              key={`youtube-${youtubeUploadJob.job_id}`}
              title={t('flights.generationLogs.youtubeUploadTitle')}
              status={youtubeUploadJob.status}
              isInProgress={['preparing', 'queued', 'uploading'].includes(
                youtubeUploadJob.status
              )}
              statusLabel={t(
                `flights.generationLogs.status.${youtubeUploadJob.status}`
              )}
              progress={youtubeUploadJob.progress}
              createdAt={youtubeUploadJob.created_at}
              startedAt={youtubeUploadJob.started_at}
              completedAt={youtubeUploadJob.completed_at}
              error={youtubeUploadJob.error}
              updatedAt={youtubeUploadJob.updated_at}
              logs={youtubeUploadJob.log_tail}
            />
          )}
          {hasHighlightLogSource && highlightVideo && (
            <LogSourceCard
              key={`highlight-${highlightVideo.job_id}`}
              title={t('flights.generationLogs.highlightVideoTitle')}
              renderMethod={highlightVideo.render_method ?? null}
              status={highlightVideo.status}
              isInProgress={['queued', 'running'].includes(
                highlightVideo.status
              )}
              statusLabel={t(
                `flights.generationLogs.status.${highlightVideo.status}`
              )}
              progress={highlightVideo.progress}
              message={highlightVideo.message}
              error={highlightVideo.error}
              createdAt={highlightVideo.created_at}
              completedAt={highlightVideo.completed_at}
              updatedAt={highlightVideo.updated_at}
              logs={highlightVideo.log_tail}
            />
          )}
        </div>
      </div>
    </>
  );
}
