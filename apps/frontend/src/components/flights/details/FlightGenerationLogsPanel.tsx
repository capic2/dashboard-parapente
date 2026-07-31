import { useTranslation } from 'react-i18next';
import type { VideoExportStatusPayload } from '../../../hooks/flights/useVideoExportStatus';
import type { GoproOverlayJob } from '../../../hooks/gopro/useGoproOverlay';
import { JobLogViewer } from '../job-logs/JobLogViewer';

type FlightGenerationLogsPanelProps = {
  videoStatus: VideoExportStatusPayload | null;
  videoFallbackStatus?: string | null;
  videoFallbackProgress?: number | null;
  goproOverlayJob: GoproOverlayJob | null;
  goproOverlayFallbackStatus?: string | null;
  goproOverlayFallbackProgress?: number | null;
};

type LogSourceCardProps = {
  title: string;
  status: string | null;
  statusLabel: string | null;
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
  status,
  statusLabel,
  progress,
  message,
  error,
  logs,
}: LogSourceCardProps) {
  const { t } = useTranslation();
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

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h4>
          {showCurrentMessage && (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {message}
            </p>
          )}
        </div>
        {statusLabel && (
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone}`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {normalizedProgress !== null && (
        <div className="mt-3" aria-label={t('flights.generationLogs.progress')}>
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
    </section>
  );
}

export function FlightGenerationLogsPanel({
  videoStatus,
  videoFallbackStatus,
  videoFallbackProgress,
  goproOverlayJob,
  goproOverlayFallbackStatus,
  goproOverlayFallbackProgress,
}: FlightGenerationLogsPanelProps) {
  const { t } = useTranslation();
  const videoStatusValue =
    videoStatus?.internal_status ??
    videoStatus?.status ??
    videoFallbackStatus ??
    null;
  const goproOverlayStatusValue =
    goproOverlayJob?.status ?? goproOverlayFallbackStatus ?? null;
  const hasVideoLogSource = Boolean(videoStatusValue || videoStatus?.job_id);
  const hasGoproOverlayLogSource = Boolean(
    goproOverlayStatusValue || goproOverlayJob?.job_id
  );

  if (!hasVideoLogSource && !hasGoproOverlayLogSource) {
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
            title={t('flights.generationLogs.videoTitle')}
            status={videoStatusValue}
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
            title={t('flights.generationLogs.goproOverlayTitle')}
            status={goproOverlayStatusValue}
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
      </div>
    </div>
  );
}
