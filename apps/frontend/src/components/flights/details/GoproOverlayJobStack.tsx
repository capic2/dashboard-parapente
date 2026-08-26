import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Layers3 } from 'lucide-react';
import type { GoproOverlayJob } from '../../../hooks/gopro/useGoproOverlay';
import type { Flight } from '../../../types';
import { GoproOverlayJobCard } from './GoproOverlayJobCard';

interface GoproOverlayJobStackProps {
  jobs: GoproOverlayJob[];
  youtubeUploadFlight: Flight;
  isDownloadingAnyMedia: boolean;
  deletingJobId: string | null;
  onDownload: (job: GoproOverlayJob) => void;
  onDelete: (job: GoproOverlayJob) => void;
}

export function GoproOverlayJobStack({
  jobs,
  youtubeUploadFlight,
  isDownloadingAnyMedia,
  deletingJobId,
  onDownload,
  onDelete,
}: GoproOverlayJobStackProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (jobs.length === 1) {
    const [job] = jobs;
    return (
      <GoproOverlayJobCard
        job={job}
        youtubeUploadFlight={
          job.status === 'completed' ? youtubeUploadFlight : undefined
        }
        isDownloadingAnyMedia={isDownloadingAnyMedia}
        isDeleting={deletingJobId === job.job_id}
        onDownload={() => onDownload(job)}
        onDelete={() => onDelete(job)}
      />
    );
  }

  return (
    <div
      className={`min-w-0 ${isExpanded ? 'sm:col-span-2 2xl:col-span-3' : ''}`}
    >
      <button
        type="button"
        className="group flex min-h-24 w-full cursor-pointer items-center gap-3 rounded-xl border border-cyan-200 bg-white p-3 text-left shadow-sm transition-colors duration-200 hover:border-cyan-400 hover:bg-cyan-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:border-cyan-800 dark:bg-slate-900/60 dark:hover:border-cyan-600 dark:hover:bg-cyan-950/20 dark:focus-visible:ring-offset-slate-900"
        aria-expanded={isExpanded}
        aria-controls="gopro-overlay-job-stack-panel"
        aria-label={t(
          isExpanded
            ? 'flights.goproOverlayStackCollapse'
            : 'flights.goproOverlayStackExpand'
        )}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
          <Layers3 className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('flights.goproOverlayStackTitle')}
          </span>
          <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">
            {t('flights.goproOverlayStackCount', { count: jobs.length })}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
          <span className="hidden sm:inline">
            {t(
              isExpanded
                ? 'flights.goproOverlayStackCollapse'
                : 'flights.goproOverlayStackExpand'
            )}
          </span>
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>
      {isExpanded && (
        <div
          id="gopro-overlay-job-stack-panel"
          className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3"
        >
          {jobs.map((job) => (
            <GoproOverlayJobCard
              key={job.job_id}
              job={job}
              youtubeUploadFlight={
                job.status === 'completed' ? youtubeUploadFlight : undefined
              }
              isDownloadingAnyMedia={isDownloadingAnyMedia}
              isDeleting={deletingJobId === job.job_id}
              onDownload={() => onDownload(job)}
              onDelete={() => onDelete(job)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
