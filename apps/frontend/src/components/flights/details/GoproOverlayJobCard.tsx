import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import { Download, LoaderCircle, Trash2, Wand2 } from 'lucide-react';
import type { GoproOverlayJob } from '../../../hooks/gopro/useGoproOverlay';
import { isGoproOverlayInProgress } from '../../../lib/flightMediaState';
import type { Flight } from '../../../types';
import { FlightMediaThumbnail } from './FlightMediaThumbnail';
import { FlightYoutubeUploadControls } from './FlightYoutubeUploadControls';

interface GoproOverlayJobCardProps {
  job: GoproOverlayJob;
  youtubeUploadFlight?: Flight;
  isDownloadingAnyMedia: boolean;
  isDeleting: boolean;
  onDownload: () => void;
  onDelete: () => void;
}

export function GoproOverlayJobCard({
  job,
  youtubeUploadFlight,
  isDownloadingAnyMedia,
  isDeleting,
  onDownload,
  onDelete,
}: GoproOverlayJobCardProps) {
  const { t } = useTranslation();
  const renderHasStarted = [
    'running',
    'completed',
    'failed',
    'cancelled',
  ].includes(job.status);
  const renderMethodLabel =
    renderHasStarted &&
    job.render_method &&
    ['cpu', 'gpu'].includes(job.render_method)
      ? t(`flights.generationLogs.method.${job.render_method}`)
      : null;
  const resolutionLabel =
    job.video_width && job.video_height
      ? `${job.video_width} × ${job.video_height}`
      : null;
  const isProcessing = isGoproOverlayInProgress(job.status);
  const progress = Math.max(0, Math.min(100, Math.round(job.progress ?? 0)));

  return (
    <div className="overflow-hidden rounded-xl border border-cyan-200 bg-white shadow-sm dark:border-cyan-800 dark:bg-slate-900/60">
      {job.status === 'completed' && (
        <FlightMediaThumbnail
          path={`/gopro-overlays/jobs/${job.job_id}/thumbnail`}
          videoPath={`/gopro-overlays/jobs/${job.job_id}/download`}
          alt={t('flights.goproOverlayJobThumbnailAlt', {
            name: job.output_filename,
          })}
        />
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
              <Wand2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('flights.goproOverlayJobTitle')}
              </p>
              <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                {job.output_filename}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {t(`flights.goproOverlayStatus.${job.status}`)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span>{job.layout_label}</span>
          {resolutionLabel && (
            <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 font-medium dark:border-slate-600 dark:bg-slate-800">
              {resolutionLabel}
            </span>
          )}
          {renderMethodLabel && (
            <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {renderMethodLabel}
            </span>
          )}
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
              aria-label={t('flights.goproOverlayProcessingBadge')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              value={progress}
              max={100}
              className="h-2 w-full accent-blue-600 dark:accent-blue-400"
            />
          </div>
        )}
        {job.status === 'completed' && (
          <div className="mt-3 space-y-2">
            <Button
              type="button"
              className="min-h-10 w-full cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed"
              onPress={onDownload}
              isDisabled={isDownloadingAnyMedia}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t('flights.goproOverlayDownload')}
            </Button>
            {youtubeUploadFlight && (
              <div>
                <FlightYoutubeUploadControls
                  flight={youtubeUploadFlight}
                  source={{
                    source_type: 'gopro_overlay',
                    gopro_overlay_job_id: job.job_id,
                  }}
                />
              </div>
            )}
          </div>
        )}
        {['completed', 'failed', 'cancelled'].includes(job.status) && (
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              className="min-h-10 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed dark:text-red-300 dark:hover:bg-red-950/30"
              onPress={onDelete}
              isDisabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {isDeleting
                ? t('flights.goproOverlayDeleting')
                : t('flights.goproOverlayDelete')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
