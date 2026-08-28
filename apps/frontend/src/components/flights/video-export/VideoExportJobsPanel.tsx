/* eslint-disable react/no-unstable-nested-components */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Button, DataTable, Modal } from '@dashboard-parapente/design-system';
import {
  Download,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Play,
  Square,
  Trash2,
} from 'lucide-react';
import {
  Button as AriaButton,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from 'react-aria-components';
import {
  type VideoExportJob,
  useCancelVideoExportJob,
  useCleanupVideoExportTempFiles,
  useDeleteVideoExportJobRow,
  useDeleteVideoExportOutput,
  useResumeVideoExportJob,
  useVideoExportJobs,
  VIDEO_EXPORT_JOBS_PAGE_SIZE,
} from '../../../hooks/flights/useVideoExportJobs';
import { useVideoExportStatus } from '../../../hooks/flights/useVideoExportStatus';
import {
  useCancelFlightHighlightVideo,
  useDeleteFlightHighlightVideo,
} from '../../../hooks/flights/useHighlightVideos';
import { useGoproOverlayJobStream } from '../../../hooks/gopro/useGoproOverlay';
import { useCancelYoutubeUpload } from '../../../hooks/flights/useYoutubeUpload';
import { api } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';
import { JobLiveLogsPanel } from './JobLiveLogsPanel';

const statusLabelFallbacks: Record<string, string> = {
  queued: 'En attente',
  running: 'Démarrage',
  initializing: 'Initialisation',
  capturing: 'Capture',
  encoding: 'Encodage',
  processing: 'En cours',
  completed: 'Terminé',
  failed: 'Erreur',
  cancelled: 'Annulé',
};

const statusClassNames: Record<string, string> = {
  completed:
    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  processing: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  queued:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const statusFilters = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'En cours' },
  { id: 'completed', label: 'Terminés' },
  { id: 'failed', label: 'Erreurs' },
  { id: 'cancelled', label: 'Annulés' },
] as const;

type StatusFilter = (typeof statusFilters)[number]['id'];

const typeFilters = [
  { id: 'all', label: 'Tous les types' },
  { id: 'video', label: 'Exports vidéo' },
  { id: 'gopro', label: 'Overlay GoPro' },
  { id: 'highlight', label: 'Meilleurs moments' },
  { id: 'youtube', label: 'Upload YouTube' },
] as const;

type TypeFilter = (typeof typeFilters)[number]['id'];

type FilterOption<T extends string> = {
  id: T;
  label: string;
  count: number;
};

const activeStatusLabels = new Set([
  'running',
  'initializing',
  'capturing',
  'encoding',
  'processing',
]);
const STALLED_JOB_THRESHOLD_MS = 5 * 60 * 1000;

const columnHelper = createColumnHelper<VideoExportJob>();

type PendingVideoConfirm = {
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

function getJobPhase(job: VideoExportJob) {
  return job.internal_status || job.status;
}

function getStatusLabelParts(job: VideoExportJob) {
  const phase = getJobPhase(job);
  let status = job.status;

  if (activeStatusLabels.has(phase)) {
    status = 'processing';
  } else if (statusLabelFallbacks[phase]) {
    status = phase;
  }

  const fallback = statusLabelFallbacks[status] || status;
  return { key: `videoJobs.status.${status}`, fallback };
}

function getModeLabelParts(mode: string) {
  if (mode === 'gopro_overlay') {
    return { key: 'videoJobs.mode.goproOverlay', fallback: 'Overlay GoPro' };
  }
  if (mode === 'highlight') {
    return { key: 'videoJobs.mode.highlight', fallback: 'Meilleurs moments' };
  }
  if (mode === 'youtube' || mode === 'youtube_upload') {
    return { key: 'videoJobs.mode.youtubeUpload', fallback: 'Upload YouTube' };
  }
  return { key: `videoJobs.mode.${mode}`, fallback: mode };
}

function getJobTypeLabelParts(job: VideoExportJob) {
  if (isGoproOverlayJob(job)) {
    return { key: 'videoJobs.type.goproOverlay', fallback: 'GoPro overlay' };
  }
  if (job.mode === 'highlight') {
    return { key: 'videoJobs.type.highlight', fallback: 'Meilleurs moments' };
  }
  if (job.mode === 'youtube_upload') {
    return { key: 'videoJobs.type.youtube', fallback: 'YouTube' };
  }

  return { key: 'videoJobs.type.video', fallback: 'Video' };
}

function getProgress(job: VideoExportJob) {
  if (typeof job.progress !== 'number' || !Number.isFinite(job.progress)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(job.progress)));
}

function getFlightLabel(job: VideoExportJob) {
  return job.flight_name || job.flight_title || job.flight_id || job.job_id;
}

function getLastActivityTime(job: VideoExportJob) {
  const rawDate =
    job.completed_at ||
    job.cancelled_at ||
    job.updated_at ||
    job.started_at ||
    job.created_at;
  if (!rawDate) {
    return 0;
  }

  const time = new Date(rawDate).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getStalledJobMinutes(job: VideoExportJob): number | null {
  const phase = getJobPhase(job);
  if (!activeStatusLabels.has(phase) || !job.updated_at) return null;
  const lastActivity = new Date(job.updated_at).getTime();
  if (!Number.isFinite(lastActivity)) return null;
  const elapsedMs = Date.now() - lastActivity;
  return elapsedMs >= STALLED_JOB_THRESHOLD_MS
    ? Math.max(1, Math.floor(elapsedMs / 60000))
    : null;
}

function getDateLabel(job: VideoExportJob) {
  const rawDate =
    job.completed_at ||
    job.cancelled_at ||
    job.updated_at ||
    job.started_at ||
    job.created_at;
  if (!rawDate) {
    return null;
  }

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(seconds?: number | null) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0)
    return '-';
  const roundedSeconds = Math.round(seconds);
  if (roundedSeconds < 60) return `${roundedSeconds} s`;
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  return `${minutes} min${remainingSeconds > 0 ? ` ${remainingSeconds} s` : ''}`;
}

function isJobInFilter(job: VideoExportJob, filter: StatusFilter) {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'active') {
    return (
      job.can_cancel ||
      ['queued', 'running', 'processing', 'uploading'].includes(job.status)
    );
  }
  return job.status === filter;
}

function isGoproOverlayJob(job: VideoExportJob) {
  return job.mode === 'gopro_overlay';
}

function isHighlightJob(job: VideoExportJob) {
  return job.mode === 'highlight';
}

function isYoutubeJob(job: VideoExportJob) {
  return job.mode === 'youtube' || job.mode === 'youtube_upload';
}

function isJobInTypeFilter(job: VideoExportJob, filter: TypeFilter) {
  return (
    filter === 'all' ||
    (filter === 'gopro' && isGoproOverlayJob(job)) ||
    (filter === 'video' &&
      !isGoproOverlayJob(job) &&
      !isHighlightJob(job) &&
      !isYoutubeJob(job)) ||
    (filter === 'highlight' && isHighlightJob(job)) ||
    (filter === 'youtube' && isYoutubeJob(job))
  );
}

function SegmentedFilter<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="grid overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900/50 sm:flex">
        {options.map((option) => {
          const isSelected = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:flex-1 sm:justify-center ${
                isSelected
                  ? 'bg-white text-sky-700 shadow-sm ring-1 ring-sky-200 dark:bg-sky-950/70 dark:text-sky-200 dark:ring-sky-800'
                  : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
              }`}
              onClick={() => onChange(option.id)}
            >
              <span className="truncate">{option.label}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                  isSelected
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200'
                    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {option.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function canDownloadJob(job: VideoExportJob) {
  return (
    job.status === 'completed' &&
    job.has_output_file !== false &&
    !isYoutubeJob(job) &&
    (!isHighlightJob(job) || Boolean(job.flight_id))
  );
}

function canDeleteJobRow(job: VideoExportJob) {
  return job.can_delete;
}

function canDeleteVideoOutput(job: VideoExportJob) {
  return (
    job.status === 'completed' &&
    job.has_output_file === true &&
    (isGoproOverlayJob(job) || (!isHighlightJob(job) && !isYoutubeJob(job)))
  );
}

function JobStatusBadge({ job }: { job: VideoExportJob }) {
  const { t } = useTranslation();
  const phase = getJobPhase(job);
  const statusLabel = getStatusLabelParts(job);
  const statusClassName =
    statusClassNames[job.status] ||
    statusClassNames[phase] ||
    statusClassNames.processing;

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName}`}
    >
      {t(statusLabel.key, statusLabel.fallback)}
    </span>
  );
}

function ProgressMeter({ progress }: { progress: number }) {
  return (
    <div className="min-w-28">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-sky-500 transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function JobTypeBadge({ job }: { job: VideoExportJob }) {
  const { t } = useTranslation();
  const typeLabel = getJobTypeLabelParts(job);

  return (
    <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200">
      {t(typeLabel.key, typeLabel.fallback)}
    </span>
  );
}

function JobRenderMethodBadge({ job }: { job: VideoExportJob }) {
  const { t } = useTranslation();
  const method = job.render_method;

  if (!method) {
    return <span>-</span>;
  }

  const className =
    method === 'gpu'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {t(`videoJobs.method.${method}`, method.toUpperCase())}
    </span>
  );
}

function FramesCell({ job }: { job: VideoExportJob }) {
  const captured = job.frames_captured;
  const total = job.total_frames ?? job.resume_from_frame;
  if (typeof captured !== 'number' && typeof total !== 'number')
    return <span>-</span>;
  return (
    <span className="whitespace-nowrap font-mono text-xs text-gray-700 dark:text-gray-200">
      {typeof captured === 'number' ? captured : '-'}
      {typeof total === 'number' && (
        <span className="text-gray-500 dark:text-gray-400"> / {total}</span>
      )}
    </span>
  );
}

function isActiveJob(job: VideoExportJob) {
  if (['queued', 'blocked', 'stalled'].includes(job.status)) {
    return false;
  }
  return (
    activeStatusLabels.has(job.status) ||
    activeStatusLabels.has(job.internal_status || '')
  );
}

function getLastLogMetrics(job: VideoExportJob) {
  const lastLogLine = job.log_tail?.[job.log_tail.length - 1];
  if (!lastLogLine) {
    return { fps: undefined, etaSeconds: undefined };
  }

  const fpsValue = lastLogLine.match(/\(([\d.,]+)\s*fps\b/iu)?.[1];
  const etaMatch = lastLogLine.match(/\bETA:\s*([\d.,]+)\s*(s|sec|min|h)\b/iu);
  const fps = fpsValue
    ? Number.parseFloat(fpsValue.replace(',', '.'))
    : undefined;
  const etaValue = etaMatch?.[1]
    ? Number.parseFloat(etaMatch[1].replace(',', '.'))
    : undefined;
  const etaUnit = etaMatch?.[2]?.toLowerCase();
  const etaSeconds =
    typeof etaValue === 'number' && Number.isFinite(etaValue)
      ? etaUnit === 'h'
        ? etaValue * 3600
        : etaUnit === 'min'
          ? etaValue * 60
          : etaValue
      : undefined;

  return { fps, etaSeconds };
}

function FpsCell({ job }: { job: VideoExportJob }) {
  if (!isActiveJob(job)) {
    return (
      <span className="whitespace-nowrap font-mono text-xs text-gray-500 dark:text-gray-400">
        0.0 fps
      </span>
    );
  }
  const { fps: loggedFps } = getLastLogMetrics(job);
  const fps = loggedFps ?? job.fps_actual;
  return typeof fps === 'number' && Number.isFinite(fps) ? (
    <span className="whitespace-nowrap font-mono text-xs text-gray-700 dark:text-gray-200">
      {fps.toFixed(1)} fps
    </span>
  ) : (
    <span>-</span>
  );
}

function JobLogsDetails({
  job,
  isOpen,
  onToggle,
}: {
  job: VideoExportJob;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { status: videoStatus } = useVideoExportStatus(
    isGoproOverlayJob(job) || isHighlightJob(job) || isYoutubeJob(job)
      ? null
      : job.job_id,
    isOpen
  );
  const { job: goproJob } = useGoproOverlayJobStream(
    isGoproOverlayJob(job) ? job.job_id : null,
    null,
    isOpen
  );
  const logs =
    (isGoproOverlayJob(job) ? goproJob?.log_tail : videoStatus?.log_tail) ??
    job.log_tail;

  return (
    <JobLiveLogsPanel
      title={t('videoJobs.liveLogs.title', 'Logs en direct')}
      emptyLabel={t(
        'videoJobs.liveLogs.empty',
        'Aucun log disponible pour le moment.'
      )}
      showLabel={t('videoJobs.liveLogs.show', 'Afficher')}
      hideLabel={t('videoJobs.liveLogs.hide', 'Masquer')}
      isOpen={isOpen}
      onToggle={onToggle}
      logs={logs}
    />
  );
}

type VideoExportJobsPanelProps = {
  limit?: number | null;
  statusFilter?: StatusFilter;
  typeFilter?: TypeFilter;
  onStatusFilterChange?: (value: StatusFilter) => void;
  onTypeFilterChange?: (value: TypeFilter) => void;
};

export function VideoExportJobsPanel({
  limit = 6,
  statusFilter: controlledStatusFilter,
  typeFilter: controlledTypeFilter,
  onStatusFilterChange,
  onTypeFilterChange,
}: VideoExportJobsPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingVideoConfirm | null>(null);
  const [localStatusFilter, setLocalStatusFilter] =
    useState<StatusFilter>('all');
  const [localTypeFilter, setLocalTypeFilter] = useState<TypeFilter>('all');
  const statusFilter = controlledStatusFilter ?? localStatusFilter;
  const typeFilter = controlledTypeFilter ?? localTypeFilter;
  const setStatusFilter = onStatusFilterChange ?? setLocalStatusFilter;
  const setTypeFilter = onTypeFilterChange ?? setLocalTypeFilter;
  const [page, setPage] = useState(1);
  const [selectedLogJob, setSelectedLogJob] = useState<VideoExportJob | null>(
    null
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'last_activity', desc: true },
  ]);
  const {
    data: jobsPage,
    isLoading,
    isError,
    refetch,
  } = useVideoExportJobs({
    page,
    pageSize: VIDEO_EXPORT_JOBS_PAGE_SIZE,
    statusFilter,
    typeFilter,
  });
  const jobs = jobsPage?.jobs ?? [];
  const totalJobs = jobsPage?.total ?? jobs.length;
  const totalPages = jobsPage?.totalPages ?? 1;
  const cancelJob = useCancelVideoExportJob();
  const cancelHighlightJob = useCancelFlightHighlightVideo('');
  const resumeJob = useResumeVideoExportJob();
  const deleteJobRow = useDeleteVideoExportJobRow();
  const deleteVideoOutput = useDeleteVideoExportOutput();
  const cancelYoutubeUpload = useCancelYoutubeUpload('');
  const deleteHighlightJob = useDeleteFlightHighlightVideo('');
  const cleanupTempFiles = useCleanupVideoExportTempFiles();

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        return (
          isJobInTypeFilter(job, typeFilter) && isJobInFilter(job, statusFilter)
        );
      }),
    [jobs, statusFilter, typeFilter]
  );
  const visibleJobs =
    typeof limit === 'number' ? filteredJobs.slice(0, limit) : filteredJobs;
  const isFiltering = statusFilter !== 'all' || typeFilter !== 'all';

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  const statusCounts = jobsPage?.statusCounts ?? {};
  const typeCounts = jobsPage?.typeCounts ?? {};
  const activeCount =
    statusCounts.active ??
    jobs.filter((job) => isJobInFilter(job, 'active')).length;
  const completedCount =
    statusCounts.completed ??
    jobs.filter((job) => job.status === 'completed').length;
  const failedCount =
    statusCounts.failed ?? jobs.filter((job) => job.status === 'failed').length;
  const cancelledCount =
    statusCounts.cancelled ??
    jobs.filter((job) => job.status === 'cancelled').length;
  const jobsInSelectedType = useMemo(
    () => jobs.filter((job) => isJobInTypeFilter(job, typeFilter)),
    [jobs, typeFilter]
  );
  const typeFilterOptions = useMemo<FilterOption<TypeFilter>[]>(
    () =>
      typeFilters.map((filter) => ({
        id: filter.id,
        label: t(`videoJobs.typeFilters.${filter.id}`, filter.label),
        count:
          typeCounts[filter.id] ??
          jobs.filter((job) => isJobInTypeFilter(job, filter.id)).length,
      })),
    [jobs, t, typeCounts]
  );
  const statusFilterOptions = useMemo<FilterOption<StatusFilter>[]>(
    () =>
      statusFilters.map((filter) => ({
        id: filter.id,
        label: t(`videoJobs.filters.${filter.id}`, filter.label),
        count:
          statusCounts[filter.id] ??
          jobsInSelectedType.filter((job) => isJobInFilter(job, filter.id))
            .length,
      })),
    [jobsInSelectedType, t, statusCounts]
  );

  const handleCancel = useCallback(
    (job: VideoExportJob) => {
      setPendingConfirm({
        message: t('videoJobs.confirmStop', 'Stopper cette génération vidéo ?'),
        confirmLabel: t('videoJobs.stop', 'Stopper'),
        onConfirm: async () => {
          try {
            if (isHighlightJob(job) && job.flight_id) {
              await cancelHighlightJob.mutateAsync({
                targetFlightId: job.flight_id,
                jobId: job.job_id,
              });
            } else if (isYoutubeJob(job) && job.flight_id) {
              await cancelYoutubeUpload.mutateAsync(job.flight_id);
            } else {
              await cancelJob.mutateAsync(job.job_id);
            }
            toast.success(t('videoJobs.stopSuccess', 'Génération stoppée'));
          } catch {
            toast.error(
              t('videoJobs.stopError', 'Impossible de stopper la génération')
            );
          }
        },
      });
    },
    [cancelHighlightJob, cancelJob, cancelYoutubeUpload, t, toast]
  );

  const handleResume = useCallback(
    async (job: VideoExportJob) => {
      try {
        await resumeJob.mutateAsync(job.job_id);
        toast.success(t('videoJobs.resumeSuccess', 'Génération relancée'));
      } catch {
        toast.error(
          t('videoJobs.resumeError', 'Impossible de relancer la génération')
        );
      }
    },
    [resumeJob, t, toast]
  );

  const handleDownload = useCallback(
    async (job: VideoExportJob) => {
      try {
        const endpoint = isGoproOverlayJob(job)
          ? `gopro-overlays/jobs/${job.job_id}/download`
          : isHighlightJob(job)
            ? `flights/${job.flight_id}/highlight-videos/${job.job_id}/download`
            : `exports/${job.job_id}/download`;
        const response = await api.get(endpoint, { timeout: false });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = job.output_filename || `${job.job_id}.mp4`;
        document.body.append(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch {
        toast.error(
          t('videoJobs.downloadError', 'Impossible de télécharger la vidéo')
        );
      }
    },
    [t, toast]
  );

  const handleDeleteJobRow = useCallback(
    (job: VideoExportJob) => {
      setPendingConfirm({
        message: t(
          'videoJobs.confirmDeleteRow',
          'Supprimer cette ligne et ses fichiers temporaires ?'
        ),
        confirmLabel: t('videoJobs.deleteRow', 'Supprimer'),
        onConfirm: async () => {
          try {
            if (isHighlightJob(job) && job.flight_id) {
              await deleteHighlightJob.mutateAsync({
                targetFlightId: job.flight_id,
                jobId: job.job_id,
              });
            } else {
              await deleteJobRow.mutateAsync(job.job_id);
            }
            toast.success(t('videoJobs.deleteRowSuccess', 'Ligne supprimée'));
          } catch {
            toast.error(
              t('videoJobs.deleteRowError', 'Impossible de supprimer la ligne')
            );
          }
        },
      });
    },
    [deleteHighlightJob, deleteJobRow, t, toast]
  );

  const handleDeleteVideoOutput = useCallback(
    (job: VideoExportJob) => {
      setPendingConfirm({
        message: t(
          'videoJobs.confirmDeleteVideo',
          'Supprimer le fichier vidéo généré ? Cette action est irréversible.'
        ),
        confirmLabel: t('videoJobs.deleteVideo', 'Supprimer la vidéo'),
        onConfirm: async () => {
          try {
            await deleteVideoOutput.mutateAsync({
              jobId: job.job_id,
              kind: isGoproOverlayJob(job) ? 'gopro' : 'video',
            });
            toast.success(t('videoJobs.deleteVideoSuccess', 'Vidéo supprimée'));
          } catch {
            toast.error(
              t('videoJobs.deleteVideoError', 'Impossible de supprimer la vidéo')
            );
          }
        },
      });
    },
    [deleteVideoOutput, t, toast]
  );

  const renderJobActions = useCallback(
    (job: VideoExportJob) => (
      <MenuTrigger>
        <AriaButton
          aria-label={t('videoJobs.table.actions', 'Actions')}
          className="flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </AriaButton>
        <Popover className="z-40 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <Menu className="outline-none">
            {job.flight_id && (
              <MenuItem
                href={`/flights/${job.flight_id}`}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
              >
                {t('videoJobs.viewFlight', 'Voir le vol')}
              </MenuItem>
            )}
            {isYoutubeJob(job) && job.youtube_url && (
              <MenuItem
                href={job.youtube_url}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t('videoJobs.openYoutube', 'Ouvrir sur YouTube')}
              </MenuItem>
            )}
            {canDownloadJob(job) && (
              <MenuItem
                onAction={() => void handleDownload(job)}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {t('videoJobs.download', 'Télécharger')}
              </MenuItem>
            )}
            {!isGoproOverlayJob(job) && job.can_resume && (
              <MenuItem
                onAction={() => void handleResume(job)}
                isDisabled={resumeJob.isPending}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                {resumeJob.isPending
                  ? t('videoJobs.resuming', 'Relance...')
                  : t('videoJobs.resume', 'Relancer')}
              </MenuItem>
            )}
            {job.can_cancel && (
              <MenuItem
                onAction={() => handleCancel(job)}
                isDisabled={
                  cancelJob.isPending ||
                  cancelHighlightJob.isPending ||
                  cancelYoutubeUpload.isPending
                }
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-700 outline-none hover:bg-red-50 focus:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40 dark:focus:bg-red-950/40"
              >
                <Square className="h-4 w-4" aria-hidden="true" />
                {cancelJob.isPending
                  ? t('videoJobs.stopping', 'Arrêt...')
                  : t('videoJobs.stop', 'Stopper')}
              </MenuItem>
            )}
            {canDeleteJobRow(job) && (
              <MenuItem
                onAction={() => handleDeleteJobRow(job)}
                isDisabled={
                  deleteJobRow.isPending || deleteHighlightJob.isPending
                }
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('videoJobs.deleteRow', 'Supprimer')}
              </MenuItem>
            )}
            {canDeleteVideoOutput(job) && (
              <MenuItem
                onAction={() => handleDeleteVideoOutput(job)}
                isDisabled={deleteVideoOutput.isPending}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('videoJobs.deleteVideo', 'Supprimer la vidéo')}
              </MenuItem>
            )}
            <MenuItem
              onAction={() => setSelectedLogJob(job)}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              {t('videoJobs.liveLogs.show', 'Logs')}
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    ),
    [
      cancelJob.isPending,
      cancelHighlightJob.isPending,
      cancelYoutubeUpload.isPending,
      deleteHighlightJob.isPending,
      deleteJobRow.isPending,
      deleteVideoOutput.isPending,
      handleCancel,
      handleDeleteJobRow,
      handleDeleteVideoOutput,
      handleDownload,
      handleResume,
      resumeJob.isPending,
      t,
    ]
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('status', {
        header: t('videoJobs.table.status', 'Statut'),
        cell: ({ row }) => <JobStatusBadge job={row.original} />,
        sortingFn: 'alphanumeric',
      }),
      columnHelper.accessor((job) => getFlightLabel(job), {
        id: 'flight',
        header: t('videoJobs.table.flight', 'Nom'),
        cell: ({ row, getValue }) => (
          <div className="max-w-64">
            <p className="truncate font-semibold text-gray-900 dark:text-white">
              {getValue()}
            </p>
            {(row.original.message || row.original.error) && (
              <p
                className={`mt-0.5 truncate text-xs ${
                  row.original.error
                    ? 'text-red-600 dark:text-red-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {row.original.error || row.original.message}
              </p>
            )}
          </div>
        ),
        sortingFn: 'alphanumeric',
      }),
      columnHelper.accessor((job) => getJobTypeLabelParts(job).fallback, {
        id: 'type',
        header: t('videoJobs.table.type', 'Type'),
        cell: ({ row }) => <JobTypeBadge job={row.original} />,
        sortingFn: 'alphanumeric',
      }),
      columnHelper.accessor('render_method', {
        header: t('videoJobs.table.method', 'Méthode'),
        cell: ({ row }) => <JobRenderMethodBadge job={row.original} />,
        sortingFn: 'alphanumeric',
      }),
      columnHelper.accessor((job) => getProgress(job), {
        id: 'progress',
        header: t('videoJobs.table.progress', 'Progression'),
        cell: ({ getValue }) => <ProgressMeter progress={getValue()} />,
        sortingFn: 'basic',
      }),
      columnHelper.accessor((job) => getLastActivityTime(job), {
        id: 'last_activity',
        header: t('videoJobs.table.lastActivity', 'Dernière activité'),
        cell: ({ row }) => getDateLabel(row.original) || '-',
        sortingFn: 'basic',
      }),
      columnHelper.display({
        id: 'frames',
        header: t('videoJobs.table.frames', 'Frames'),
        cell: ({ row }) => <FramesCell job={row.original} />,
      }),
      columnHelper.display({
        id: 'fps',
        header: t('videoJobs.table.fps', 'Frame / seconde'),
        cell: ({ row }) => <FpsCell job={row.original} />,
      }),
      columnHelper.display({
        id: 'eta',
        header: t('videoJobs.table.eta', 'Temps restant'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-gray-700 dark:text-gray-200">
            {row.original.status === 'completed'
              ? t('videoJobs.done', 'Terminé')
              : formatDuration(
                  getLastLogMetrics(row.original).etaSeconds ??
                    row.original.eta_seconds
                )}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: t('videoJobs.table.actions', 'Actions'),
        cell: ({ row }) => renderJobActions(row.original),
      }),
    ],
    [renderJobActions, t]
  );

  const table = useReactTable({
    data: visibleJobs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function handleCleanupTempFiles() {
    setPendingConfirm({
      message: t(
        'videoJobs.confirmCleanupTempFiles',
        'Supprimer les fichiers temporaires des générations terminées, échouées ou annulées ?'
      ),
      confirmLabel: t('videoJobs.cleanupTempFiles', 'Nettoyer les temporaires'),
      onConfirm: async () => {
        try {
          const result = await cleanupTempFiles.mutateAsync();
          const deletedCount = result.files_deleted + result.dirs_deleted;
          if (result.errors.length > 0) {
            toast.error(
              t(
                'videoJobs.cleanupPartialError',
                '{{count}} élément(s) supprimé(s), mais certains fichiers n’ont pas pu être supprimés',
                { count: deletedCount }
              )
            );
            return;
          }

          toast.success(
            t(
              'videoJobs.cleanupSuccess',
              '{{count}} élément(s) temporaire(s) supprimé(s)',
              { count: deletedCount }
            )
          );
        } catch {
          toast.error(
            t(
              'videoJobs.cleanupError',
              'Impossible de supprimer les fichiers temporaires'
            )
          );
        }
      },
    });
  }

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-sky-100 bg-white shadow-md dark:border-sky-900/60 dark:bg-gray-800">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('videoJobs.title', 'Générations vidéo')}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {activeCount > 0
              ? t('videoJobs.activeCount', '{{count}} génération en cours', {
                  count: activeCount,
                })
              : t('videoJobs.noActive', 'Aucune génération en cours')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
              {t('videoJobs.summary.active', '{{count}} actifs', {
                count: activeCount,
              })}
            </span>
            <span className="rounded-full bg-green-50 px-2.5 py-1 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-200">
              {t('videoJobs.summary.completed', '{{count}} terminés', {
                count: completedCount,
              })}
            </span>
            <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700 dark:bg-red-900/40 dark:text-red-200">
              {t('videoJobs.summary.failed', '{{count}} erreurs', {
                count: failedCount,
              })}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              {t('videoJobs.summary.cancelled', '{{count}} annulés', {
                count: cancelledCount,
              })}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={handleCleanupTempFiles}
            isDisabled={cleanupTempFiles.isPending}
            className="cursor-pointer rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          >
            {cleanupTempFiles.isPending
              ? t('videoJobs.cleaningTempFiles', 'Nettoyage...')
              : t('videoJobs.cleanupTempFiles', 'Nettoyer les temporaires')}
          </Button>
          <Button
            onClick={() => refetch()}
            className="cursor-pointer rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            {t('common.retry', 'Rafraîchir')}
          </Button>
        </div>
      </div>

      {isError && (
        <div className="p-4 text-sm text-red-600 dark:text-red-300">
          {t(
            'videoJobs.loadError',
            'Impossible de charger les générations vidéo'
          )}
        </div>
      )}

      {isLoading && (
        <div
          className="space-y-3 p-4"
          aria-label={t('common.loading', 'Chargement...')}
        >
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-2 w-full animate-pulse rounded-full bg-gray-100 dark:bg-gray-700" />
          <div className="h-2 w-2/3 animate-pulse rounded-full bg-gray-100 dark:bg-gray-700" />
        </div>
      )}

      {!isLoading && !isError && jobs.length === 0 && (
        <div className="border-t border-gray-100 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          {t('videoJobs.empty', 'Aucune génération vidéo pour le moment.')}
        </div>
      )}

      {!isLoading && !isError && jobs.length > 0 && (
        <div className="space-y-4 border-t border-gray-100 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/20">
          <div className="flex flex-col gap-4 xl:flex-row">
            <SegmentedFilter
              label={t('videoJobs.filterLabels.type', 'Type')}
              options={typeFilterOptions}
              value={typeFilter}
              onChange={setTypeFilter}
            />
            <SegmentedFilter
              label={t('videoJobs.filterLabels.status', 'Statut')}
              options={statusFilterOptions}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
          <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {isFiltering || visibleJobs.length !== totalJobs || totalPages > 1
                ? t(
                    'videoJobs.filteredSummary',
                    '{{visible}} génération(s) affichée(s) sur {{total}} · page {{page}}/{{pages}}',
                    {
                      visible: visibleJobs.length,
                      total: totalJobs,
                      page,
                      pages: totalPages,
                    }
                  )
                : t(
                    'videoJobs.visibleSummary',
                    '{{visible}} génération(s) affichée(s)',
                    { visible: visibleJobs.length }
                  )}
            </span>
            {isFiltering && (
              <Button
                onClick={() => {
                  setTypeFilter('all');
                  setStatusFilter('all');
                }}
                className="cursor-pointer self-start rounded-lg px-3 py-1.5 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:text-sky-300 dark:hover:bg-sky-950/40 sm:self-auto"
              >
                {t('videoJobs.resetFilters', 'Réinitialiser')}
              </Button>
            )}
          </div>
        </div>
      )}

      {!isLoading &&
        !isError &&
        jobs.length > 0 &&
        visibleJobs.length === 0 && (
          <div className="border-t border-gray-100 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
            {t(
              'videoJobs.emptyFiltered',
              'Aucune génération ne correspond à ce filtre.'
            )}
          </div>
        )}

      {!isLoading && !isError && visibleJobs.length > 0 && (
        <>
          <div className="hidden p-3 md:block">
            <DataTable
              table={table}
              emptyMessage={t(
                'videoJobs.emptyFiltered',
                'Aucune génération ne correspond à ce filtre.'
              )}
            />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 md:hidden">
            {visibleJobs.map((job) => {
              const progress = getProgress(job);
              const dateLabel = getDateLabel(job);
              const modeLabel = job.mode ? getModeLabelParts(job.mode) : null;

              return (
                <article key={job.job_id} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <JobStatusBadge job={job} />
                        <JobTypeBadge job={job} />
                        {modeLabel && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                            {t(modeLabel.key, modeLabel.fallback)}
                          </span>
                        )}
                        {dateLabel && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {dateLabel}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {getFlightLabel(job)}
                      </h3>
                      {getStalledJobMinutes(job) !== null && !job.error && (
                        <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-300">
                          {t(
                            'videoJobs.stalled',
                            'Aucune progression depuis {{minutes}} min. Le traitement semble bloqué.',
                            {
                              minutes: getStalledJobMinutes(job),
                            }
                          )}
                        </p>
                      )}
                      {(job.message || job.error) && (
                        <p
                          className={`mt-1 text-sm ${
                            job.error
                              ? 'text-red-600 dark:text-red-300'
                              : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {job.error || job.message}
                        </p>
                      )}
                    </div>

                    {renderJobActions(job)}
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        {t('flights.viewer.videoProgress', 'Progression')}
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-[width] duration-200 motion-reduce:transition-none"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                      <div className="text-gray-500 dark:text-gray-400">
                        {t('videoJobs.table.method', 'Méthode')}
                      </div>
                      <div className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">
                        {job.render_method?.toUpperCase() || '-'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                      <div className="text-gray-500 dark:text-gray-400">
                        {t('videoJobs.table.frames', 'Frames')}
                      </div>
                      <div className="mt-0.5 font-mono font-semibold text-gray-800 dark:text-gray-100">
                        <FramesCell job={job} />
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                      <div className="text-gray-500 dark:text-gray-400">
                        {t('videoJobs.table.fps', 'Frame / seconde')}
                      </div>
                      <div className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">
                        <FpsCell job={job} />
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                      <div className="text-gray-500 dark:text-gray-400">
                        {t('videoJobs.table.eta', 'Temps restant')}
                      </div>
                      <div className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">
                        {formatDuration(
                          getLastLogMetrics(job).etaSeconds ?? job.eta_seconds
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {limit === null && totalPages > 1 && (
            <nav
              aria-label={t('videoJobs.pagination.label', 'Pagination')}
              className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700"
            >
              <Button
                isDisabled={page === 1 || isLoading}
                onClick={() => setPage((currentPage) => currentPage - 1)}
                className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100"
              >
                {t('videoJobs.pagination.previous', 'Précédente')}
              </Button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {t('videoJobs.pagination.page', 'Page {{page}} sur {{pages}}', {
                  page,
                  pages: totalPages,
                })}
              </span>
              <Button
                isDisabled={page >= totalPages || isLoading}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100"
              >
                {t('videoJobs.pagination.next', 'Suivante')}
              </Button>
            </nav>
          )}
        </>
      )}
      <Modal
        isOpen={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        title={t('common.confirm', 'Confirmation')}
        size="sm"
        role="alertdialog"
      >
        {pendingConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {pendingConfirm.message}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                initialFocus
                variant="secondary"
                onPress={() => setPendingConfirm(null)}
              >
                {t('common.cancel', 'Annuler')}
              </Button>
              <Button
                variant="danger"
                onPress={() => {
                  void pendingConfirm.onConfirm();
                  setPendingConfirm(null);
                }}
              >
                {pendingConfirm.confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={selectedLogJob !== null}
        onClose={() => setSelectedLogJob(null)}
        title={
          selectedLogJob
            ? `${t('videoJobs.liveLogs.title', 'Logs')} — ${getFlightLabel(selectedLogJob)}`
            : t('videoJobs.liveLogs.title', 'Logs')
        }
        size="lg"
      >
        {selectedLogJob && (
          <JobLogsDetails
            job={selectedLogJob}
            isOpen
            onToggle={() => setSelectedLogJob(null)}
          />
        )}
      </Modal>
    </section>
  );
}
