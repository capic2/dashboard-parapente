import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import { Download, LoaderCircle, Sparkles, Trash2 } from 'lucide-react';
import type { HighlightVideoJob } from '@dashboard-parapente/shared-types';
import type { Flight } from '../../../types';
import { FlightYoutubeUploadControls } from './FlightYoutubeUploadControls';

interface HighlightVideoJobCardProps {
  job: HighlightVideoJob | null;
  flight: Flight;
  isDownloadingAnyMedia: boolean;
  isGenerationPending: boolean;
  isCancellationPending: boolean;
  isDeletionPending: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export function HighlightVideoJobCard({
  job,
  flight,
  isDownloadingAnyMedia,
  isGenerationPending,
  isCancellationPending,
  isDeletionPending,
  onGenerate,
  onCancel,
  onDownload,
  onDelete,
}: HighlightVideoJobCardProps) {
  const { t } = useTranslation();
  const status = job?.status ?? null;
  const isProcessing = status === 'queued' || status === 'running';
  const progress = Math.max(0, Math.min(100, Math.round(job?.progress ?? 0)));
  const statusLabel = status
    ? t(`flights.generationLogs.status.${status}`)
    : t('flights.videoNotGenerated');

  return (
    <div className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm dark:border-violet-800 dark:bg-slate-900/60">
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('flights.highlightVideoTitle')}
              </p>
              <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                {job?.message ?? statusLabel}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {statusLabel}
          </span>
        </div>
        {isProcessing && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-blue-800 dark:text-blue-200">
              <span className="flex items-center gap-1.5">
                <LoaderCircle
                  className="h-3.5 w-3.5 motion-safe:animate-spin"
                  aria-hidden="true"
                />
                {t('flights.mediaExportInProgress')}
              </span>
              <span>{progress}%</span>
            </div>
            <progress
              aria-label={t('flights.generationLogs.progress')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              value={progress}
              max={100}
              className="h-2 w-full accent-blue-600 dark:accent-blue-400"
            />
          </div>
        )}
        {status === 'completed' && job && (
          <div className="mt-3 space-y-2">
            <Button
              type="button"
              className="min-h-10 w-full cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed"
              onPress={onDownload}
              isDisabled={isDownloadingAnyMedia}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t('flights.highlightVideoDownload')}
            </Button>
            <FlightYoutubeUploadControls
              flight={flight}
              source={{
                source_type: 'highlight',
                highlight_video_job_id: job.job_id,
              }}
            />
          </div>
        )}
        {['completed', 'failed', 'cancelled'].includes(status ?? '') && job && (
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              className="min-h-10 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed dark:text-red-300 dark:hover:bg-red-950/30"
              onPress={onDelete}
              isDisabled={isDeletionPending}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {isDeletionPending
                ? t('flights.highlightVideoDeleting')
                : t('flights.highlightVideoDelete')}
            </Button>
          </div>
        )}
        {status !== 'completed' &&
          (isProcessing ? (
            <Button
              variant="danger"
              className="mt-3 min-h-10 w-full rounded-lg px-3 py-2 text-sm"
              onPress={onCancel}
              isDisabled={isCancellationPending}
            >
              {isCancellationPending
                ? t('common.stopping')
                : t('flights.highlightVideoCancel')}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="mt-3 min-h-10 w-full rounded-lg border-violet-300 px-3 py-2 text-sm dark:border-violet-700"
              onPress={onGenerate}
              isDisabled={isGenerationPending}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {isGenerationPending
                ? t('flights.highlightVideoStarting')
                : t('flights.highlightVideoGenerate')}
            </Button>
          ))}
      </div>
    </div>
  );
}
