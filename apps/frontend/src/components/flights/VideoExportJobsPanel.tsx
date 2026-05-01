import { useTranslation } from 'react-i18next';
import { Button } from '@dashboard-parapente/design-system';
import {
  type VideoExportJob,
  useCancelVideoExportJob,
  useCleanupVideoExportTempFiles,
  useVideoExportJobs,
} from '../../hooks/flights/useVideoExportJobs';
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

function getJobPhase(job: VideoExportJob) {
  return job.internal_status || job.status;
}

function getStatusLabelParts(job: VideoExportJob) {
  const phase = getJobPhase(job);
  const status = statusLabelFallbacks[phase] ? phase : job.status;
  const fallback = statusLabelFallbacks[status] || status;
  return { key: `videoJobs.status.${status}`, fallback };
}

function getProgress(job: VideoExportJob) {
  if (typeof job.progress !== 'number' || !Number.isFinite(job.progress)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(job.progress)));
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

export function VideoExportJobsPanel({ limit = 6 }: { limit?: number | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: jobs = [], isLoading, isError, refetch } = useVideoExportJobs();
  const cancelJob = useCancelVideoExportJob();
  const cleanupTempFiles = useCleanupVideoExportTempFiles();
  const visibleJobs = typeof limit === 'number' ? jobs.slice(0, limit) : jobs;

  const activeCount = jobs.filter((job) => job.can_cancel).length;

  async function handleCancel(job: VideoExportJob) {
    if (
      !window.confirm(
        t('videoJobs.confirmStop', 'Stopper cette génération vidéo ?')
      )
    ) {
      return;
    }

    try {
      await cancelJob.mutateAsync(job.job_id);
      toast.success(t('videoJobs.stopSuccess', 'Génération stoppée'));
    } catch {
      toast.error(
        t('videoJobs.stopError', 'Impossible de stopper la génération')
      );
    }
  }

  async function handleCleanupTempFiles() {
    if (
      !window.confirm(
        t(
          'videoJobs.confirmCleanupTempFiles',
          'Supprimer les fichiers temporaires des générations terminées, échouées ou annulées ?'
        )
      )
    ) {
      return;
    }

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
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={handleCleanupTempFiles}
            disabled={cleanupTempFiles.isPending}
            className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          >
            {cleanupTempFiles.isPending
              ? t('videoJobs.cleaningTempFiles', 'Nettoyage...')
              : t('videoJobs.cleanupTempFiles', 'Nettoyer les temporaires')}
          </Button>
          <Button
            onClick={() => refetch()}
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
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
        <div className="p-4 text-sm text-gray-600 dark:text-gray-300">
          {t('common.loading', 'Chargement...')}
        </div>
      )}

      {!isLoading && !isError && visibleJobs.length === 0 && (
        <div className="p-4 text-sm text-gray-600 dark:text-gray-300">
          {t('videoJobs.empty', 'Aucune génération vidéo pour le moment.')}
        </div>
      )}

      {!isLoading && !isError && visibleJobs.length > 0 && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {visibleJobs.map((job) => {
            const progress = getProgress(job);
            const phase = getJobPhase(job);
            const dateLabel = getDateLabel(job);
            const statusLabel = getStatusLabelParts(job);
            const statusClassName =
              statusClassNames[job.status] ||
              statusClassNames[phase] ||
              statusClassNames.processing;

            return (
              <article key={job.job_id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName}`}
                      >
                        {t(statusLabel.key, statusLabel.fallback)}
                      </span>
                      {job.mode && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                          {job.mode}
                        </span>
                      )}
                      {dateLabel && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {dateLabel}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {job.flight_title ||
                        job.flight_name ||
                        job.flight_id ||
                        job.job_id}
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

                  {job.can_cancel && (
                    <Button
                      onClick={() => handleCancel(job)}
                      disabled={cancelJob.isPending}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {cancelJob.isPending
                        ? t('videoJobs.stopping', 'Arrêt...')
                        : t('videoJobs.stop', 'Stopper')}
                    </Button>
                  )}
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
                      className="h-full rounded-full bg-sky-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
