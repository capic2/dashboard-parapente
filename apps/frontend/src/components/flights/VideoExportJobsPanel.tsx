import { useCallback, useMemo, useState } from 'react';
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
  type VideoExportJob,
  useCancelVideoExportJob,
  useCleanupVideoExportTempFiles,
  useDeleteVideoExportJobRow,
  useResumeVideoExportJob,
  useVideoExportJobs,
} from '../../hooks/flights/useVideoExportJobs';
import { api } from '../../lib/api';
import { useToast } from '../../hooks/useToast';

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
] as const;

type TypeFilter = (typeof typeFilters)[number]['id'];

const columnHelper = createColumnHelper<VideoExportJob>();

const actionButtonClassName =
  'cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500';

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
  const status = statusLabelFallbacks[phase] ? phase : job.status;
  const fallback = statusLabelFallbacks[status] || status;
  return { key: `videoJobs.status.${status}`, fallback };
}

function getModeLabelParts(mode: string) {
  if (mode === 'gopro_overlay') {
    return { key: 'videoJobs.mode.goproOverlay', fallback: 'Overlay GoPro' };
  }
  return { key: `videoJobs.mode.${mode}`, fallback: mode };
}

function getProgress(job: VideoExportJob) {
  if (typeof job.progress !== 'number' || !Number.isFinite(job.progress)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(job.progress)));
}

function getFlightLabel(job: VideoExportJob) {
  return job.flight_title || job.flight_name || job.flight_id || job.job_id;
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

function isJobInFilter(job: VideoExportJob, filter: StatusFilter) {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'active') {
    return (
      job.can_cancel || ['queued', 'running', 'processing'].includes(job.status)
    );
  }
  return job.status === filter;
}

function isGoproOverlayJob(job: VideoExportJob) {
  return job.mode === 'gopro_overlay';
}

function canDownloadJob(job: VideoExportJob) {
  return job.status === 'completed' && job.has_output_file !== false;
}

function canDeleteJobRow(job: VideoExportJob) {
  return !job.can_cancel;
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

function JobModeBadge({ mode }: { mode: string }) {
  const { t } = useTranslation();
  const modeLabel = getModeLabelParts(mode);

  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200">
      {t(modeLabel.key, modeLabel.fallback)}
    </span>
  );
}

export function VideoExportJobsPanel({ limit = 6 }: { limit?: number | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingVideoConfirm | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'last_activity', desc: true },
  ]);
  const { data: jobs = [], isLoading, isError, refetch } = useVideoExportJobs();
  const cancelJob = useCancelVideoExportJob();
  const resumeJob = useResumeVideoExportJob();
  const deleteJobRow = useDeleteVideoExportJobRow();
  const cleanupTempFiles = useCleanupVideoExportTempFiles();

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const isInTypeFilter =
          typeFilter === 'all' ||
          (typeFilter === 'gopro' && isGoproOverlayJob(job)) ||
          (typeFilter === 'video' && !isGoproOverlayJob(job));
        return isInTypeFilter && isJobInFilter(job, statusFilter);
      }),
    [jobs, statusFilter, typeFilter]
  );
  const visibleJobs =
    typeof limit === 'number' ? filteredJobs.slice(0, limit) : filteredJobs;

  const activeCount = jobs.filter((job) => job.can_cancel).length;
  const completedCount = jobs.filter(
    (job) => job.status === 'completed'
  ).length;
  const failedCount = jobs.filter((job) => job.status === 'failed').length;
  const cancelledCount = jobs.filter(
    (job) => job.status === 'cancelled'
  ).length;

  const handleCancel = useCallback(
    (job: VideoExportJob) => {
      setPendingConfirm({
        message: t('videoJobs.confirmStop', 'Stopper cette génération vidéo ?'),
        confirmLabel: t('videoJobs.stop', 'Stopper'),
        onConfirm: async () => {
          try {
            await cancelJob.mutateAsync(job.job_id);
            toast.success(t('videoJobs.stopSuccess', 'Génération stoppée'));
          } catch {
            toast.error(
              t('videoJobs.stopError', 'Impossible de stopper la génération')
            );
          }
        },
      });
    },
    [cancelJob, t, toast]
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
            await deleteJobRow.mutateAsync(job.job_id);
            toast.success(t('videoJobs.deleteRowSuccess', 'Ligne supprimée'));
          } catch {
            toast.error(
              t('videoJobs.deleteRowError', 'Impossible de supprimer la ligne')
            );
          }
        },
      });
    },
    [deleteJobRow, t, toast]
  );

  const renderJobActions = useCallback(
    (job: VideoExportJob) => (
      <div className="flex flex-wrap gap-2">
        {job.flight_id && (
          <a
            href={`/flights/${job.flight_id}`}
            className={`${actionButtonClassName} border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 focus-visible:outline-sky-500 dark:border-sky-800 dark:bg-gray-800 dark:text-sky-300 dark:hover:bg-sky-950/40`}
          >
            {t('videoJobs.viewFlight', 'Voir le vol')}
          </a>
        )}
        {canDownloadJob(job) && (
          <Button
            onClick={() => void handleDownload(job)}
            className={`${actionButtonClassName} bg-sky-100 text-sky-800 hover:bg-sky-200 focus-visible:outline-sky-500 dark:bg-sky-900/40 dark:text-sky-200 dark:hover:bg-sky-900/60`}
          >
            {t('videoJobs.download', 'Télécharger')}
          </Button>
        )}
        {!isGoproOverlayJob(job) && job.can_resume && (
          <Button
            onClick={() => void handleResume(job)}
            isDisabled={resumeJob.isPending}
            className={`${actionButtonClassName} bg-green-100 text-green-800 hover:bg-green-200 focus-visible:outline-green-500 dark:bg-green-900/40 dark:text-green-200 dark:hover:bg-green-900/60`}
          >
            {resumeJob.isPending
              ? t('videoJobs.resuming', 'Relance...')
              : t('videoJobs.resume', 'Reprendre')}
          </Button>
        )}
        {job.can_cancel && (
          <Button
            onClick={() => handleCancel(job)}
            isDisabled={cancelJob.isPending}
            className={`${actionButtonClassName} bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-500`}
          >
            {cancelJob.isPending
              ? t('videoJobs.stopping', 'Arrêt...')
              : t('videoJobs.stop', 'Stopper')}
          </Button>
        )}
        {canDeleteJobRow(job) && (
          <Button
            onClick={() => handleDeleteJobRow(job)}
            isDisabled={deleteJobRow.isPending}
            className={`${actionButtonClassName} bg-gray-100 text-gray-800 hover:bg-gray-200 focus-visible:outline-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600`}
          >
            {t('videoJobs.deleteRow', 'Supprimer')}
          </Button>
        )}
        {!job.flight_id &&
          !canDownloadJob(job) &&
          !job.can_resume &&
          !job.can_cancel &&
          !canDeleteJobRow(job) && (
            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
          )}
      </div>
    ),
    [
      cancelJob.isPending,
      deleteJobRow.isPending,
      handleCancel,
      handleDeleteJobRow,
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
        header: t('videoJobs.table.flight', 'Vol'),
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
      columnHelper.accessor('mode', {
        header: t('videoJobs.table.mode', 'Mode'),
        cell: ({ getValue }) => {
          const mode = getValue();
          return mode ? <JobModeBadge mode={mode} /> : <span>-</span>;
        },
        sortingFn: 'alphanumeric',
      }),
      columnHelper.accessor((job) => getProgress(job), {
        id: 'progress',
        header: t('videoJobs.table.progress', 'Progression'),
        cell: ({ getValue }) => <ProgressMeter progress={getValue()} />,
        sortingFn: 'basic',
      }),
      columnHelper.accessor((job) => getJobPhase(job), {
        id: 'phase',
        header: t('videoJobs.table.phase', 'Phase'),
        cell: ({ getValue }) => {
          const phase = getValue();
          return t(
            `videoJobs.status.${phase}`,
            statusLabelFallbacks[phase] || phase
          );
        },
        sortingFn: 'alphanumeric',
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
        cell: ({ row }) => {
          const { frames_captured: frames, resume_from_frame: resumeFrom } =
            row.original;
          if (typeof frames !== 'number' && typeof resumeFrom !== 'number') {
            return <span>-</span>;
          }
          return (
            <span className="text-gray-700 dark:text-gray-200">
              {typeof frames === 'number' ? frames : '-'}
              {typeof resumeFrom === 'number' && (
                <span className="text-gray-500 dark:text-gray-400">
                  {' '}
                  / {resumeFrom}
                </span>
              )}
            </span>
          );
        },
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
        <div className="space-y-3 border-t border-gray-100 p-3 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            {typeFilters.map((filter) => {
              const isSelected = typeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                    isSelected
                      ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-300 dark:bg-sky-300 dark:text-sky-950'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-sky-300 hover:bg-sky-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-sky-700 dark:hover:bg-sky-950/40'
                  }`}
                  onClick={() => setTypeFilter(filter.id)}
                >
                  {t(`videoJobs.typeFilters.${filter.id}`, filter.label)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => {
              const isSelected = statusFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                    isSelected
                      ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-300 dark:bg-sky-300 dark:text-sky-950'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-sky-300 hover:bg-sky-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-sky-700 dark:hover:bg-sky-950/40'
                  }`}
                  onClick={() => setStatusFilter(filter.id)}
                >
                  {t(`videoJobs.filters.${filter.id}`, filter.label)}
                </button>
              );
            })}
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
                </article>
              );
            })}
          </div>
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
    </section>
  );
}
