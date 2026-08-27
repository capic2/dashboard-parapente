import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Layers3 } from 'lucide-react';
import type { GoproOverlayJob } from '../../../hooks/gopro/useGoproOverlay';
import type { Flight } from '../../../types';
import { FlightMediaThumbnail } from './FlightMediaThumbnail';
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

const previewCardClasses = [
  'inset-x-4 top-4 -rotate-6 group-hover:-rotate-12',
  'inset-x-2 top-2 rotate-3 group-hover:rotate-6',
  'inset-x-0 top-0 rotate-12 group-hover:rotate-[16deg]',
];

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
  const isCollapsed = !isExpanded;
  const previewJobs = jobs.slice(0, 3);
  const panelId = 'gopro-overlay-job-stack-panel';

  return (
    <div
      className={`order-5 min-w-0 ${isExpanded ? 'sm:col-span-2 2xl:col-span-3' : ''}`}
    >
      {isCollapsed ? (
        <button
          type="button"
          className="group relative flex min-h-64 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-cyan-200 bg-slate-950 p-4 text-left shadow-sm transition-colors duration-200 hover:border-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:border-cyan-800 dark:focus-visible:ring-offset-slate-900"
          aria-expanded={false}
          aria-controls={panelId}
          aria-label={t('flights.goproOverlayStackExpand')}
          onClick={() => setIsExpanded(true)}
        >
          <span className="relative block h-48 w-44" aria-hidden="true">
            {previewJobs.map((job, index) => (
              <span
                key={job.job_id}
                className={`absolute ${previewCardClasses[index]} h-40 overflow-hidden rounded-xl border border-cyan-100 bg-white shadow-xl transition-transform duration-200`}
              >
                {job.status === 'completed' ? (
                  <FlightMediaThumbnail
                    path={`/gopro-overlays/jobs/${job.job_id}/thumbnail`}
                    alt={job.output_filename}
                    interactive={false}
                  />
                ) : (
                  <span className="flex h-full items-center justify-center bg-slate-100 text-cyan-600">
                    <Layers3 className="h-8 w-8" aria-hidden="true" />
                  </span>
                )}
              </span>
            ))}
            <span className="absolute inset-x-4 top-7 flex h-36 -rotate-2 flex-col items-center justify-center rounded-xl border border-cyan-200 bg-white/75 p-3 text-center text-slate-900 shadow-2xl backdrop-blur-[1px] transition-transform duration-200 group-hover:rotate-0">
              <Layers3 className="h-7 w-7 text-cyan-600" aria-hidden="true" />
              <span className="mt-2 text-sm font-bold">
                {t('flights.goproOverlayStackTitle')}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                {t('flights.goproOverlayStackCount', { count: jobs.length })}
              </span>
            </span>
          </span>
          <span className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2 text-xs font-semibold text-white">
            {t('flights.goproOverlayStackExpand')}
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:text-cyan-300"
            aria-expanded
            aria-controls={panelId}
            onClick={() => setIsExpanded(false)}
          >
            {t('flights.goproOverlayStackCollapse')}
            <ChevronDown className="h-4 w-4 rotate-180" aria-hidden="true" />
          </button>
        </div>
      )}
      {isExpanded && (
        <div
          id={panelId}
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
