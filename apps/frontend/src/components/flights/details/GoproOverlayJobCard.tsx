import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import { Download } from 'lucide-react';
import type { GoproOverlayJob } from '../../../hooks/gopro/useGoproOverlay';

interface GoproOverlayJobCardProps {
  job: GoproOverlayJob;
  isDownloadingAnyMedia: boolean;
  onDownload: () => void;
}

export function GoproOverlayJobCard({
  job,
  isDownloadingAnyMedia,
  onDownload,
}: GoproOverlayJobCardProps) {
  const { t } = useTranslation();
  const renderMethodLabel =
    job.render_method && ['cpu', 'gpu'].includes(job.render_method)
      ? t(`flights.generationLogs.method.${job.render_method}`)
      : null;

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('flights.goproOverlayJobTitle')}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <p>
              {job.layout_label} · {job.output_filename}
            </p>
            {renderMethodLabel && (
              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {renderMethodLabel}
              </span>
            )}
          </div>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
          {t(`flights.goproOverlayStatus.${job.status}`)}
        </span>
      </div>
      {job.status === 'completed' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
          <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
            {job.output_filename}
          </span>
          <Button
            type="button"
            className="min-h-9 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            onPress={onDownload}
            isDisabled={isDownloadingAnyMedia}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {t('flights.goproOverlayDownload')}
          </Button>
        </div>
      )}
    </div>
  );
}
