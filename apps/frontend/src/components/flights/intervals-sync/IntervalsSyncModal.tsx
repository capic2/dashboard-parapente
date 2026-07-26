import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, DatePicker, Button } from '@dashboard-parapente/design-system';
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';
import {
  useIntervalsPreview,
  useIntervalsSyncMutation,
} from '../../../hooks/flights/useFlights';
import { useIntervalsStatus } from '../../../hooks/admin/useIntervalsStatus';
import { useToast } from '../../../hooks/useToast';

interface IntervalsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

export function IntervalsSyncModal({
  isOpen,
  onClose,
  onSyncComplete,
}: IntervalsSyncModalProps) {
  const { t } = useTranslation();
  const [dateFrom, setDateFrom] = useState(
    () =>
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
  );
  const [dateTo, setDateTo] = useState(
    () => new Date().toISOString().split('T')[0]
  );

  const statusQuery = useIntervalsStatus(isOpen);
  const canPreview = Boolean(statusQuery.data?.configured);
  const canImport = Boolean(
    statusQuery.data?.configured && statusQuery.data.activity_types.length > 0
  );
  const previewQuery = useIntervalsPreview(
    dateFrom,
    dateTo,
    isOpen && canPreview
  );
  const {
    mutate: syncIntervals,
    reset: resetSync,
    isPending,
    data,
  } = useIntervalsSyncMutation();
  const toast = useToast();
  const invalidRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const handleSync = () => {
    resetSync();
    syncIntervals(
      { date_from: dateFrom, date_to: dateTo },
      {
        onSuccess: (result) => {
          toast.success(
            t('intervals.importToast', {
              imported: result.imported,
              updated: result.updated,
              skipped: result.skipped,
            })
          );
          onSyncComplete();
          void previewQuery.refetch();
        },
        onError: (error: Error) => {
          toast.error(error.message);
        },
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('intervals.title')}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('intervals.description')}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DatePicker
            label={t('intervals.from')}
            value={dateFrom}
            onChange={setDateFrom}
          />
          <DatePicker
            label={t('intervals.to')}
            value={dateTo}
            onChange={setDateTo}
          />
        </div>

        {invalidRange && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          >
            {t('intervals.invalidRange')}
          </div>
        )}

        <div aria-live="polite" className="min-h-20">
          {statusQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              {t('intervals.checkingConfiguration')}
            </div>
          )}

          {statusQuery.isError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
            >
              <CircleAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              {t('intervals.statusError')}
            </div>
          )}

          {statusQuery.data && !statusQuery.data.configured && (
            <output className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <CircleAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              {t('intervals.unconfigured')}
            </output>
          )}

          {statusQuery.data?.configured && !statusQuery.data.enabled && (
            <output className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <CircleAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              {t('intervals.disabled')}
            </output>
          )}

          {canPreview && previewQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              {t('intervals.loadingPreview')}
            </div>
          )}

          {canPreview && previewQuery.isError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
            >
              <CircleAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              {previewQuery.error.message}
            </div>
          )}

          {previewQuery.data && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t('intervals.discoveredTypes')}
                </h3>
                {previewQuery.data.activity_types.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {previewQuery.data.activity_types.map((type) => (
                      <span
                        key={type}
                        className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('intervals.noDiscoveredTypes')}
                  </p>
                )}
              </div>

              {previewQuery.data.activities.length === 0 ? (
                <p className="border-t border-gray-200 pt-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                  {t('intervals.emptyPreview')}
                </p>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t('intervals.candidates', {
                      count: previewQuery.data.activities.length,
                    })}
                  </h3>
                  <ul
                    className="mt-2 max-h-56 space-y-2 overflow-y-auto"
                    aria-label={t('intervals.candidateList')}
                  >
                    {previewQuery.data.activities.map((activity) => (
                      <li
                        key={activity.id}
                        className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {activity.name}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {new Date(
                                activity.start_date_local
                              ).toLocaleString()}{' '}
                              · {activity.source} · {activity.file_type}
                            </p>
                          </div>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            {activity.type}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {statusQuery.data?.awaiting_activity_type && previewQuery.data && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              {t('intervals.configureDiscoveredType')}
            </div>
          )}
        </div>

        {data && !isPending && (
          <output className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/20">
            <p className="mb-2 flex items-center gap-2 font-semibold text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {t('intervals.syncComplete')}
            </p>
            <ul className="space-y-1 text-sm text-green-700 dark:text-green-300">
              <li>{t('intervals.imported', { count: data.imported })}</li>
              <li>{t('intervals.updated', { count: data.updated })}</li>
              <li>{t('intervals.skipped', { count: data.skipped })}</li>
              {data.failed > 0 && (
                <li className="text-orange-700 dark:text-orange-400">
                  {t('intervals.failures', { count: data.failed })}
                </li>
              )}
            </ul>
          </output>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            onClick={onClose}
            className="min-h-11 cursor-pointer rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            isDisabled={isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSync}
            isDisabled={
              isPending ||
              invalidRange ||
              !dateFrom ||
              !dateTo ||
              !canImport ||
              previewQuery.isLoading ||
              previewQuery.isError ||
              !previewQuery.data?.activities.length
            }
            className="min-h-11 cursor-pointer rounded-lg bg-orange-600 px-6 py-2 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <LoaderCircle
                  className="mr-2 inline h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                {t('intervals.syncing')}
              </>
            ) : (
              t('intervals.import')
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
