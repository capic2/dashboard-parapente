import {
  CheckCircle2,
  Circle,
  CircleAlert,
  LoaderCircle,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  BackgroundOperation,
  BackgroundOperationStep,
} from '@dashboard-parapente/shared-types';

function stepIcon(step: BackgroundOperationStep) {
  if (step.status === 'completed' || step.status === 'skipped') {
    return (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
    );
  }
  if (step.status === 'failed') {
    return <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />;
  }
  if (step.status === 'running') {
    return (
      <LoaderCircle
        className="h-4 w-4 animate-spin text-sky-500"
        aria-hidden="true"
      />
    );
  }
  return (
    <Circle
      className="h-4 w-4 text-slate-300 dark:text-slate-600"
      aria-hidden="true"
    />
  );
}

export function OperationProgressBar({
  progress,
}: {
  progress: number | null | undefined;
}) {
  const indeterminate = progress == null;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        className={`h-full rounded-full bg-sky-500 transition-[width] duration-300 motion-reduce:transition-none ${indeterminate ? 'w-1/3 animate-pulse' : ''}`}
        style={
          indeterminate
            ? undefined
            : { width: `${Math.max(0, Math.min(100, progress))}%` }
        }
      />
    </div>
  );
}

export function OperationTimeline({
  operation,
}: {
  operation: BackgroundOperation;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="space-y-3"
      aria-label={t('operations.timeline', 'Progression du traitement')}
    >
      {operation.steps.map((step) => (
        <div key={step.key} className="flex items-start gap-2.5">
          <div className="mt-0.5 shrink-0">{stepIcon(step)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span
                className={
                  step.status === 'running'
                    ? 'font-semibold text-sky-700 dark:text-sky-300'
                    : 'text-slate-700 dark:text-slate-200'
                }
              >
                {t(`operations.steps.${step.key}`, step.key)}
              </span>
              {step.status === 'running' && step.progress != null && (
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {step.progress}%
                </span>
              )}
            </div>
            {step.status === 'running' && (
              <div className="mt-1.5">
                <OperationProgressBar progress={step.progress} />
              </div>
            )}
            {step.detail && (
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {step.detail}
              </p>
            )}
          </div>
        </div>
      ))}
      {operation.status === 'failed' && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {operation.error_detail ||
              t('operations.genericError', 'Le traitement a échoué')}
          </span>
        </div>
      )}
    </div>
  );
}
