import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCircle2, Square, XCircle } from 'lucide-react';
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Popover,
} from 'react-aria-components';
import type { BackgroundOperation } from '@dashboard-parapente/shared-types';
import {
  useCancelOperation,
  useMarkOperationRead,
  useOperations,
  useRetryOperation,
} from '../../hooks/useOperations';
import { requestJobNotificationPermission } from '../../hooks/useJobNotifications';
import { useToast } from '../../hooks/useToast';
import { OperationProgressBar, OperationTimeline } from './OperationTimeline';

function statusColor(status: BackgroundOperation['status']) {
  if (status === 'failed') return 'text-red-600 dark:text-red-300';
  if (status === 'completed') return 'text-emerald-600 dark:text-emerald-300';
  return 'text-sky-600 dark:text-sky-300';
}

function resultSummary(result: BackgroundOperation['result']) {
  if (!result) return [];
  return Object.entries(result)
    .filter(([, value]) =>
      ['string', 'number', 'boolean'].includes(typeof value)
    )
    .slice(0, 4);
}

export function OperationCenter() {
  const { t } = useTranslation();
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | null>(() =>
      typeof window !== 'undefined' && 'Notification' in window
        ? Notification.permission
        : null
    );
  const { data: operations = [] } = useOperations();
  const markRead = useMarkOperationRead();
  const cancel = useCancelOperation();
  const retry = useRetryOperation();
  const toast = useToast();
  const [selected, setSelected] = useState<BackgroundOperation | null>(null);
  const displayableOperations = useMemo(
    () => operations.filter((operation) => operation.status !== 'cancelled'),
    [operations]
  );
  const activeCount = operations.filter(
    (operation) =>
      operation.status === 'queued' || operation.status === 'running'
  ).length;
  const unreadCount = displayableOperations.filter(
    (operation) => operation.unread
  ).length;
  const visibleOperations = useMemo(
    () => displayableOperations.slice(0, 8),
    [displayableOperations]
  );

  function openOperation(operation: BackgroundOperation) {
    setSelected(operation);
    if (operation.unread) void markRead.mutateAsync(operation.operation_id);
  }

  async function enableJobNotifications() {
    setNotificationPermission(await requestJobNotificationPermission());
  }

  async function cancelOperation(operation: BackgroundOperation) {
    try {
      await cancel.mutateAsync(operation.operation_id);
      toast.success(t('operations.cancelSuccess', 'Traitement stoppé'));
    } catch {
      toast.error(
        t('operations.cancelError', 'Impossible de stopper le traitement')
      );
    }
  }

  return (
    <>
      <DialogTrigger>
        <AriaButton
          className="relative inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-md bg-gray-200 px-2 text-gray-700 transition-colors hover:bg-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          aria-label={t('operations.openCenter', 'Ouvrir les traitements')}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {(activeCount > 0 || unreadCount > 0) && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white">
              {activeCount + unreadCount}
            </span>
          )}
        </AriaButton>
        <Popover className="z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <Dialog className="outline-none">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Heading
                slot="title"
                className="text-sm font-semibold text-slate-900 dark:text-white"
              >
                {t('operations.title', 'Traitements')}
              </Heading>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {activeCount} {t('operations.active', 'en cours')}
              </span>
            </div>
            {notificationPermission === 'default' && (
              <AriaButton
                onPress={() => void enableJobNotifications()}
                className="mb-3 flex min-h-11 w-full cursor-pointer items-center justify-start rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-sky-300 dark:hover:border-sky-700 dark:hover:bg-slate-800"
              >
                {t(
                  'operations.enableNotifications',
                  'Activer les notifications'
                )}
              </AriaButton>
            )}
            {visibleOperations.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('operations.empty', 'Aucun traitement récent')}
              </p>
            ) : (
              <div className="max-h-[min(32rem,70vh)] space-y-2 overflow-y-auto">
                {visibleOperations.map((operation) => {
                  const title = t(
                    operation.title_key,
                    operation.operation_type
                  );
                  const isCancelling =
                    cancel.isPending &&
                    cancel.variables === operation.operation_id;

                  return (
                    <div
                      key={operation.operation_id}
                      className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${operation.unread ? 'border-sky-200 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/20' : 'border-slate-200 dark:border-slate-700'}`}
                    >
                      <AriaButton
                        onPress={() => openOperation(operation)}
                        className="min-w-0 flex-1 cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-sm font-medium ${statusColor(operation.status)}`}
                          >
                            {title}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            {operation.progress == null
                              ? '—'
                              : `${operation.progress}%`}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {operation.current_step_detail ||
                            (operation.current_step_key
                              ? t(
                                  `operations.steps.${operation.current_step_key}`,
                                  operation.current_step_key
                                )
                              : t(
                                  `operations.status.${operation.status}`,
                                  operation.status
                                ))}
                        </p>
                        <div className="mt-2">
                          <OperationProgressBar progress={operation.progress} />
                        </div>
                      </AriaButton>
                      {operation.can_cancel && (
                        <AriaButton
                          onPress={() => void cancelOperation(operation)}
                          isDisabled={isCancelling}
                          aria-label={`${t('operations.cancel', 'Stopper')} ${title}`}
                          title={t('operations.cancel', 'Stopper')}
                          className="inline-flex min-h-10 min-w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-red-200 text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-wait disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                        >
                          <Square className="h-4 w-4" aria-hidden="true" />
                        </AriaButton>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
      <ModalOverlay
        isOpen={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <Modal className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
          <Dialog className="outline-none">
            {selected && (
              <>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <Heading
                      slot="title"
                      className="text-lg font-semibold text-slate-900 dark:text-white"
                    >
                      {t(selected.title_key, selected.operation_type)}
                    </Heading>
                    <p
                      className={`mt-1 text-sm ${statusColor(selected.status)}`}
                    >
                      {t(
                        `operations.status.${selected.status}`,
                        selected.status
                      )}
                    </p>
                  </div>
                  {selected.status === 'completed' && (
                    <CheckCircle2
                      className="h-6 w-6 text-emerald-500"
                      aria-hidden="true"
                    />
                  )}
                  {selected.status === 'failed' && (
                    <XCircle
                      className="h-6 w-6 text-red-500"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <OperationTimeline operation={selected} />
                {resultSummary(selected.result).length > 0 && (
                  <div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                      {t('operations.result', 'Résultat')}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {resultSummary(selected.result).map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt className="truncate">
                            {t(`operations.resultFields.${key}`, key)}
                          </dt>
                          <dd className="text-right font-medium tabular-nums">
                            {String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                {selected.can_cancel && (
                  <button
                    type="button"
                    className="mt-5 min-h-10 cursor-pointer rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                    onClick={() =>
                      void cancel.mutateAsync(selected.operation_id)
                    }
                  >
                    {t('operations.cancel', 'Annuler')}
                  </button>
                )}
                {selected.can_retry && (
                  <button
                    type="button"
                    className="mt-5 ml-2 min-h-10 cursor-pointer rounded-md border border-sky-200 px-3 text-sm font-medium text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950/30"
                    onClick={() =>
                      void retry.mutateAsync(selected.operation_id)
                    }
                  >
                    {t('operations.retry', 'Relancer')}
                  </button>
                )}
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
