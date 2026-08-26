import { useState } from 'react';
import type { ReactNode } from 'react';
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
  generationCard: ReactNode;
}

export function GoproOverlayJobStack({
  jobs,
  youtubeUploadFlight,
  isDownloadingAnyMedia,
  deletingJobId,
  onDownload,
  onDelete,
  generationCard,
}: GoproOverlayJobStackProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`min-w-0 ${isExpanded ? 'sm:col-span-2 2xl:col-span-3' : ''}`}
    >
      <button
        type="button"
        className="group relative flex min-h-64 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-cyan-200 bg-slate-950 p-4 text-left shadow-sm transition-colors duration-200 hover:border-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:border-cyan-800 dark:focus-visible:ring-offset-slate-900"
        aria-expanded={isExpanded}
        aria-controls="gopro-overlay-job-stack-panel"
        aria-label={t(
          isExpanded
            ? 'flights.goproOverlayStackCollapse'
            : 'flights.goproOverlayStackExpand'
        )}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span className="relative block h-48 w-44" aria-hidden="true">
          <span className="absolute inset-x-5 top-2 h-40 rotate-12 rounded-xl border border-slate-200 bg-white shadow-lg transition-transform duration-200 group-hover:rotate-[16deg]" />
          <span className="absolute inset-x-3 top-1 h-[10.5rem] -rotate-6 rounded-xl border border-slate-200 bg-white shadow-lg transition-transform duration-200 group-hover:-rotate-12" />
          <span className="absolute inset-x-1 top-4 h-40 rotate-3 rounded-xl border border-cyan-100 bg-white shadow-xl transition-transform duration-200 group-hover:rotate-6" />
          <span className="absolute inset-x-4 top-7 flex h-36 -rotate-2 flex-col items-center justify-center rounded-xl border border-cyan-200 bg-white p-3 text-center text-slate-900 shadow-2xl transition-transform duration-200 group-hover:rotate-0">
            <Layers3 className="h-7 w-7 text-cyan-600" />
            <span className="mt-2 text-sm font-bold">
              {t('flights.goproOverlayStackTitle')}
            </span>
            <span className="mt-1 text-xs text-slate-500">
              {t('flights.goproOverlayStackCount', { count: jobs.length })}
            </span>
          </span>
        </span>
        <span className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2 text-xs font-semibold text-white">
          {t(
            isExpanded
              ? 'flights.goproOverlayStackCollapse'
              : 'flights.goproOverlayStackExpand'
          )}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
          {generationCard}
        </div>
      )}
    </div>
  );
}
