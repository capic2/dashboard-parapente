import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseApiUtcDate } from '../../lib/date';
import { useDeploymentDrainStatus } from '../../hooks/admin/useDeploymentDrainStatus';
import { useAuthStore } from '../../stores/authStore';

export default function DeploymentStatusBanner() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data: status } = useDeploymentDrainStatus(isAuthenticated);
  const [now, setNow] = useState(() => Date.now());
  const phase = status?.phase;

  useEffect(() => {
    if (!phase || phase === 'idle') return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [phase]);

  if (!status || status.phase === 'idle') return null;

  const blockingJobs = status.active_jobs + status.admissions_in_progress;
  const isDeploying = status.phase === 'deploying';
  const phaseStartedAt = isDeploying
    ? status.phase_changed_at
    : status.requested_at;
  const requestedAt = phaseStartedAt
    ? parseApiUtcDate(phaseStartedAt).getTime()
    : Number.NaN;
  const elapsedMinutes = Number.isNaN(requestedAt)
    ? null
    : Math.max(0, Math.floor((now - requestedAt) / 60_000));
  let detail = t('infrastructure.deployment.readyDetail');
  if (isDeploying) {
    detail = t('infrastructure.deployment.deployingDetail');
  } else if (blockingJobs > 0) {
    detail = t('infrastructure.deployment.blockedDetail', {
      count: blockingJobs,
    });
  }

  return (
    <output
      aria-live="polite"
      aria-labelledby="deployment-status-title"
      className={`block rounded-2xl border p-4 shadow-md ${
        isDeploying
          ? 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40'
          : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
      }`}
    >
      <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="block">
          <span className="flex flex-wrap items-center gap-2">
            <span
              id="deployment-status-title"
              className="font-semibold text-gray-900 dark:text-white"
            >
              {t(
                isDeploying
                  ? 'infrastructure.deployment.deployingTitle'
                  : 'infrastructure.deployment.waitingTitle'
              )}
            </span>
            {status.target_version && (
              <span className="rounded-full bg-white/80 px-2.5 py-1 font-mono text-xs text-gray-700 ring-1 ring-black/5 dark:bg-gray-900/60 dark:text-gray-200 dark:ring-white/10">
                {status.target_version}
              </span>
            )}
          </span>
          <span className="mt-1 block text-sm text-gray-700 dark:text-gray-300">
            {detail}
            {elapsedMinutes !== null && (
              <span className="ml-1">
                {t(
                  isDeploying
                    ? 'infrastructure.deployment.deployingElapsed'
                    : 'infrastructure.deployment.waitingElapsed',
                  { count: elapsedMinutes }
                )}
              </span>
            )}
          </span>
        </span>
        {status.run_url && (
          <a
            href={status.run_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {t('infrastructure.deployment.openRun')}
          </a>
        )}
      </span>
    </output>
  );
}
