import {
  VIDEO_EXPORT_IN_PROGRESS_STATUSES,
  type HighlightVideoJob,
} from '@dashboard-parapente/shared-types';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VideoExportStatusPayload } from '../../../hooks/flights/useVideoExportStatus';
import type { YoutubeUploadJob } from '../../../hooks/flights/useYoutubeUpload';
import type { GoproOverlayJob } from '../../../hooks/gopro/useGoproOverlay';
import { isGoproOverlayInProgress } from '../../../lib/flightMediaState';
import { JobLogViewer } from '../job-logs/JobLogViewer';

type FlightGenerationLogsPanelProps = {
  videoJobId?: string | null;
  videoStatus: VideoExportStatusPayload | null;
  videoFallbackStatus?: string | null;
  videoFallbackProgress?: number | null;
  goproOverlayJob: GoproOverlayJob | null;
  goproOverlayJobId?: string | null;
  goproOverlayFallbackStatus?: string | null;
  goproOverlayFallbackProgress?: number | null;
  youtubeUploadJob: YoutubeUploadJob | null;
  highlightVideo: HighlightVideoJob | null;
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
  logs?: string[] | null;
};

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
  logs,
}: LogSourceCardProps) {
  const { t } = useTranslation();
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const isOpen = openOverride ?? isInProgress;
  const lines = logs?.filter(Boolean) ?? [];
  const normalizedProgress = clampProgress(progress);
  const hasDetails = Boolean(message || error || lines.length > 0);
  const statusTone = getStatusTone(status);
  const showCurrentMessage = Boolean(
    message && !lines.some((line) => line.includes(message))
  );
  const isLive = Boolean(
    status && !['cancelled', 'completed', 'failed'].includes(status)
  );
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

          {normalizedProgress !== null && (
            <div
              className="mt-3"
              aria-label={t('flights.generationLogs.progress')}
            >
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>{t('flights.generationLogs.progress')}</span>
                <span>{normalizedProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${normalizedProgress}%` }}
                />
              </div>
            </div>
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
  goproOverlayJobId,
  goproOverlayFallbackStatus,
  goproOverlayFallbackProgress,
  youtubeUploadJob,
  highlightVideo,
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
  const hasYoutubeUploadLogSource = Boolean(youtubeUploadJob?.job_id);
  const hasHighlightLogSource = Boolean(highlightVideo?.job_id);

  if (
    !hasVideoLogSource &&
    !hasGoproOverlayLogSource &&
    !hasYoutubeUploadLogSource &&
    !hasHighlightLogSource
  ) {
    return null;
  }

  return (
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
            logs={videoStatus?.log_tail}
          />
        )}
        {hasGoproOverlayLogSource && (
          <LogSourceCard
            key={`gopro-${goproOverlayJob?.job_id ?? goproOverlayJobId ?? 'fallback'}`}
            title={t('flights.generationLogs.goproOverlayTitle')}
            renderMethod={
              goproOverlayJob && ['running', 'completed', 'failed', 'cancelled'].includes(
                goproOverlayJob.status
              )
                ? (goproOverlayJob.render_method ?? null)
                : null
            }
            status={goproOverlayStatusValue}
            isInProgress={isGoproOverlayInProgress(goproOverlayStatusValue)}
            statusLabel={
              goproOverlayStatusValue
                ? t(`flights.generationLogs.status.${goproOverlayStatusValue}`)
                : null
            }
            progress={goproOverlayJob?.progress ?? goproOverlayFallbackProgress}
            message={goproOverlayJob?.message}
            error={goproOverlayJob?.error}
            logs={goproOverlayJob?.log_tail}
          />
        )}
        {hasYoutubeUploadLogSource && youtubeUploadJob && (
          <LogSourceCard
            key={`youtube-${youtubeUploadJob.job_id}`}
            title={t('flights.generationLogs.youtubeUploadTitle')}
            status={youtubeUploadJob.status}
            isInProgress={['queued', 'uploading'].includes(
              youtubeUploadJob.status
            )}
            statusLabel={t(
              `flights.generationLogs.status.${youtubeUploadJob.status}`
            )}
            progress={youtubeUploadJob.progress}
            error={youtubeUploadJob.error}
            logs={youtubeUploadJob.log_tail}
          />
        )}
        {hasHighlightLogSource && highlightVideo && (
          <LogSourceCard
            key={`highlight-${highlightVideo.job_id}`}
            title={t('flights.generationLogs.highlightVideoTitle')}
            status={highlightVideo.status}
            isInProgress={['queued', 'running'].includes(highlightVideo.status)}
            statusLabel={t(
              `flights.generationLogs.status.${highlightVideo.status}`
            )}
            progress={highlightVideo.progress}
            message={highlightVideo.message}
            error={highlightVideo.error}
          />
        )}
      </div>
    </div>
  );
}
