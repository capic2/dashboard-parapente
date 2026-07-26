import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Checkbox, Input, TextField } from 'react-aria-components';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import {
  Button,
  DataTable,
  Modal,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  ToastContainer,
} from '@dashboard-parapente/design-system';
import {
  useCacheOverview,
  useCacheKeyDetail,
  useDeleteCacheKey,
} from '../hooks/admin/useCache';
import type { CacheKeyInfo } from '../hooks/admin/useCache';
import { useIntervalsStatus } from '../hooks/admin/useIntervalsStatus';
import { VideoExportJobsPanel } from '../components/flights/video-export/VideoExportJobsPanel';
import { useToastStore } from '../hooks/useToast';
import {
  normalizeInfrastructureTab,
  type InfrastructureSearch,
  type InfrastructureTab,
} from '../routes/infrastructure';

// --- Helpers ---

interface PendingConfirm {
  message: string;
  onConfirm: () => void;
}

function formatTtl(ttl: number): string {
  if (ttl < 0) return '—';
  if (ttl === 0) return '0s';
  const h = Math.floor(ttl / 3600);
  const m = Math.floor((ttl % 3600) / 60);
  const s = ttl % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function CacheKeyCell({ value }: { value: string }) {
  return (
    <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate block max-w-xs">
      {value}
    </span>
  );
}

function ResolvedCell({ resolved }: { resolved: CacheKeyInfo['resolved'] }) {
  const { t } = useTranslation();

  return (
    <span className="text-xs text-gray-600 dark:text-gray-400">
      {getResolvedLabel(resolved, t)}
    </span>
  );
}

function TtlCell({ value }: { value: number }) {
  return (
    <span className="text-xs text-gray-600 dark:text-gray-400">
      {formatTtl(value)}
    </span>
  );
}

function SizeCell({ value }: { value: number }) {
  return (
    <span className="text-xs text-gray-600 dark:text-gray-400">
      {formatSize(value)}
    </span>
  );
}

function CacheActionsCell({
  row,
  onViewKey,
  onDeleteKey,
  isPending,
}: {
  row: CacheKeyInfo;
  onViewKey: (key: string) => void;
  onDeleteKey: (key: string) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        onPress={() => onViewKey(row.key)}
        className="min-h-11 px-3 py-2 sm:min-h-0 sm:px-2 sm:py-1 rounded text-xs bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors cursor-pointer"
      >
        {t('cache.view')}
      </Button>
      <Button
        onPress={() => onDeleteKey(row.key)}
        isDisabled={isPending}
        className="min-h-11 px-3 py-2 sm:min-h-0 sm:px-2 sm:py-1 rounded text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {t('cache.deleteKey')}
      </Button>
    </div>
  );
}

function buildCacheColumns({
  t,
  onViewKey,
  onDeleteKey,
  isPending,
}: {
  t: (key: string, options?: Record<string, unknown>) => string;
  onViewKey: (key: string) => void;
  onDeleteKey: (key: string) => void;
  isPending: boolean;
}) {
  return [
    columnHelper.accessor('key', {
      header: t('cache.key'),
      cell: (info) => <CacheKeyCell value={info.getValue()} />,
    }),
    columnHelper.accessor('resolved', {
      header: t('cache.resolved'),
      cell: (info) => <ResolvedCell resolved={info.getValue()} />,
    }),
    columnHelper.accessor('ttl', {
      header: t('cache.ttl'),
      meta: { className: 'hidden sm:table-cell' },
      cell: (info) => <TtlCell value={info.getValue()} />,
    }),
    columnHelper.accessor('size', {
      header: t('cache.size'),
      meta: { className: 'hidden sm:table-cell' },
      cell: (info) => <SizeCell value={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: t('cache.actions'),
      cell: (info) => (
        <CacheActionsCell
          row={info.row.original}
          onViewKey={onViewKey}
          onDeleteKey={onDeleteKey}
          isPending={isPending}
        />
      ),
    }),
  ];
}

// oxlint-disable-next-line max-lines-per-function
export function getResolvedLabel(
  resolved: CacheKeyInfo['resolved'],
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (!resolved) {
    return t('cache.noResolution');
  }

  if (resolved.label === 'best_spot_for_day') {
    return t('cache.resolvedBestSpot', {
      day: String((resolved.details || {}).day_index ?? ''),
    });
  }

  if (resolved.label === 'weather_forecast') {
    if (resolved.details && resolved.details.site_name) {
      return t('cache.resolvedWeatherForecastWithSite', {
        site: String(resolved.details.site_name),
        day: String(
          (resolved.details as Record<string, unknown>).day_index ?? ''
        ),
      });
    }

    return t('cache.resolvedWeatherForecast');
  }

  if (resolved.label === 'emagram_sounding') {
    if (resolved.details && resolved.details.station && resolved.details.date) {
      return t('cache.resolvedEmagram', {
        station: String((resolved.details as Record<string, unknown>).station),
        date: String((resolved.details as Record<string, unknown>).date),
      });
    }

    return t('cache.resolvedEmagram');
  }

  if (resolved.label === 'emagram_analysis') {
    if (resolved.details && resolved.details.site_id && resolved.details.date) {
      const rawHour = (resolved.details as Record<string, unknown>).hour;
      let hourLabel = '';

      if (rawHour === 'latest') {
        hourLabel = t('cache.latest');
      } else if (rawHour !== undefined && rawHour !== '') {
        const numericHour = Number(rawHour);
        hourLabel = Number.isFinite(numericHour)
          ? `${String(numericHour)}h`
          : String(rawHour);
      }

      return t('cache.resolvedEmagramAnalysis', {
        site: String((resolved.details as Record<string, unknown>).site_id),
        date: String((resolved.details as Record<string, unknown>).date),
        hour: hourLabel,
      });
    }

    return t('cache.resolvedEmagramAnalysis');
  }

  return t('cache.resolutionGeneric');
}

// =============================================================================
// INTERVALS.ICU SECTION
// =============================================================================

function IntervalsStatusSection() {
  const { t } = useTranslation();
  const { data: status, isLoading, isError } = useIntervalsStatus();

  const statusLabel = status?.configured
    ? t('infrastructure.intervals.configured')
    : t('infrastructure.intervals.notConfigured');
  const statusTone: 'green' | 'amber' | 'red' | 'gray' = status?.configured
    ? 'green'
    : 'red';
  const statusClassName = status?.configured
    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {t('infrastructure.intervals.title')}
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t('infrastructure.intervals.description')}
        </p>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-md dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          {t('common.loading')}
        </div>
      )}
      {isError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
        >
          {t('infrastructure.intervals.statusError')}
        </div>
      )}
      {status && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfrastructureStatCard
              label={t('infrastructure.intervals.status')}
              value={statusLabel}
              detail={t('infrastructure.intervals.statusDetail')}
              tone={statusTone}
            />
            <InfrastructureStatCard
              label={t('infrastructure.intervals.activityTypes')}
              value={t('infrastructure.intervals.typeCount', {
                count: status.activity_types.length,
              })}
              detail={t('infrastructure.intervals.activityTypesDetail')}
              tone={status.activity_types.length > 0 ? 'green' : 'gray'}
            />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('infrastructure.intervals.activityTypes')}
              </h4>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClassName}`}
              >
                {statusLabel}
              </span>
            </div>
            {status.activity_types.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {status.activity_types.map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
                  >
                    {type}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {t('infrastructure.intervals.noActivityTypes')}
              </p>
            )}
            <p className="mt-4 border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {t('infrastructure.intervals.apiKeyEnvOnly')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// CACHE SECTION
// =============================================================================

// oxlint-disable-next-line max-lines-per-function
function CacheSection({
  autoRefresh,
  searchFilter,
  onAutoRefreshChange,
  onSearchFilterChange,
}: {
  autoRefresh: boolean;
  searchFilter: string;
  onAutoRefreshChange: (autoRefresh: boolean) => void;
  onSearchFilterChange: (searchFilter: string) => void;
}) {
  const { t } = useTranslation();
  const deferredSearchFilter = useDeferredValue(searchFilter);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null
  );

  const { data: overview, refetch } = useCacheOverview(
    autoRefresh ? 5000 : undefined
  );
  const { data: keyDetail } = useCacheKeyDetail(selectedKey);
  const deleteMutation = useDeleteCacheKey();

  const filteredGroups = useMemo(() => {
    if (!deferredSearchFilter) return overview.groups;

    const lower = deferredSearchFilter.toLowerCase();
    const result: typeof overview.groups = {};
    for (const [prefix, group] of Object.entries(overview.groups)) {
      const filteredKeys = group.keys.filter((k) => {
        const values = [
          k.key,
          getResolvedLabel(k.resolved, t),
          ...(k.resolved?.details ? Object.values(k.resolved.details) : []),
        ];

        return values
          .map((value) => String(value).toLowerCase())
          .some((value) => value.includes(lower));
      });
      if (filteredKeys.length > 0) {
        result[prefix] = { count: filteredKeys.length, keys: filteredKeys };
      }
    }
    return result;
  }, [overview, deferredSearchFilter, t]);

  const toggleGroup = (prefix: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  };

  const requestConfirm = useCallback(
    (message: string, onConfirm: () => void) => {
      setPendingConfirm({ message, onConfirm });
    },
    []
  );

  const handleDeleteKey = (key: string) => {
    requestConfirm(t('cache.confirmDelete'), () => deleteMutation.mutate(key));
  };

  const handleClearPattern = (pattern: string) => {
    requestConfirm(t('cache.confirmClearPattern', { pattern }), () =>
      deleteMutation.mutate(pattern)
    );
  };

  const handleClearAll = () => {
    requestConfirm(t('cache.confirmClearAll'), () =>
      deleteMutation.mutate('*')
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {t('cache.title')}
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t(
            'cache.description',
            'Inspecte les clés actives, leur TTL et les groupes les plus volumineux.'
          )}
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md text-center">
          <div className="text-3xl font-bold text-sky-600 dark:text-sky-400">
            {overview.total_keys}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('cache.totalKeys')}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md text-center">
          <div className="text-3xl font-bold text-sky-600 dark:text-sky-400">
            {overview.memory_usage ?? '—'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('cache.memoryUsage')}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md text-center">
          <div className="text-3xl font-bold text-sky-600 dark:text-sky-400">
            {Object.keys(overview.groups).length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('cache.groups')}
          </div>
        </div>
      </div>

      {/* Truncated warning */}
      {overview.truncated && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-200">
          {t('cache.truncatedWarning')}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <Checkbox
          isSelected={autoRefresh}
          onChange={onAutoRefreshChange}
          className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 group"
        >
          {({ isSelected }: { isSelected: boolean }) => (
            <>
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-sky-600 border-sky-600'
                    : 'border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-700'
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3 text-white"
                    viewBox="0 0 14 14"
                    fill="none"
                  >
                    <path
                      d="M3 7l3 3 5-6"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              {t('cache.autoRefresh')}
            </>
          )}
        </Checkbox>
        <Button
          onPress={() => refetch()}
          className="min-h-11 px-4 py-2.5 sm:min-h-0 sm:px-3 sm:py-1.5 rounded-md bg-sky-600 text-white text-sm hover:bg-sky-700 transition-colors cursor-pointer"
        >
          {t('cache.refresh')}
        </Button>
        <TextField
          value={searchFilter}
          onChange={onSearchFilterChange}
          aria-label={t('cache.searchPlaceholder')}
          className="flex-1 min-w-[200px]"
        >
          <Input
            placeholder={t('cache.searchPlaceholder')}
            className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 focus:ring-sky-500"
          />
        </TextField>
        <Button
          onPress={handleClearAll}
          isDisabled={deleteMutation.isPending}
          className="min-h-11 px-4 py-2.5 sm:min-h-0 sm:px-3 sm:py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {t('cache.clearAll')}
        </Button>
      </div>

      {/* Groups */}
      {Object.keys(filteredGroups).length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center text-gray-500 dark:text-gray-400">
          {t('cache.noKeys')}
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(filteredGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([prefix, group]) => (
              <GroupSection
                key={prefix}
                prefix={prefix}
                group={group}
                isExpanded={expandedGroups.has(prefix)}
                onToggle={() => toggleGroup(prefix)}
                onClearPattern={() => handleClearPattern(`${prefix}:*`)}
                onViewKey={(key) => setSelectedKey(key)}
                onDeleteKey={handleDeleteKey}
                isPending={deleteMutation.isPending}
              />
            ))}
        </div>
      )}

      {/* Key detail modal */}
      <Modal
        isOpen={selectedKey !== null}
        onClose={() => setSelectedKey(null)}
        title={t('cache.keyDetail')}
        size="xl"
      >
        {keyDetail && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  {t('cache.key')}
                </span>
                <p className="font-mono text-xs break-all text-gray-800 dark:text-gray-200">
                  {keyDetail.key}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  {t('cache.resolved')}
                </span>
                <p className="text-gray-800 dark:text-gray-200">
                  {keyDetail.resolved
                    ? getResolvedLabel(keyDetail.resolved, t)
                    : t('cache.noResolution')}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  {t('cache.ttl')}
                </span>
                <p className="text-gray-800 dark:text-gray-200">
                  {formatTtl(keyDetail.ttl)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  {t('cache.size')}
                </span>
                <p className="text-gray-800 dark:text-gray-200">
                  {formatSize(keyDetail.size)}
                </p>
              </div>
            </div>
            {keyDetail.type === 'json' &&
              typeof keyDetail.value === 'object' &&
              keyDetail.value !== null &&
              'cached_at' in (keyDetail.value as Record<string, unknown>) && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {t('cache.cachedAt')}:{' '}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200">
                    {String(
                      (keyDetail.value as Record<string, unknown>).cached_at
                    )}
                  </span>
                </div>
              )}
            <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 text-xs font-mono overflow-auto max-h-[60vh] text-gray-800 dark:text-gray-200">
              {JSON.stringify(keyDetail.value, null, 2)}
            </pre>
          </div>
        )}
      </Modal>

      {/* Confirm dialog */}
      <Modal
        isOpen={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        title={t('common.confirm')}
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
                onPress={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onPress={() => {
                  pendingConfirm.onConfirm();
                  setPendingConfirm(null);
                }}
                className="px-4 py-2 rounded-md text-sm text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
              >
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

function InfrastructureStatCard({
  label,
  value,
  detail,
  tone = 'sky',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'sky' | 'green' | 'amber' | 'red' | 'gray';
}) {
  const toneClassNames = {
    sky: 'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300',
    green:
      'border-green-100 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300',
    amber:
      'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
    red: 'border-red-100 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
    gray: 'border-gray-100 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClassNames[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>
      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {detail}
      </div>
    </div>
  );
}

function InfrastructureOverview() {
  const { t } = useTranslation();
  const { data: intervalsStatus, isLoading: intervalsLoading } =
    useIntervalsStatus();
  const { data: cacheOverview } = useCacheOverview();

  const cacheGroups = Object.keys(cacheOverview.groups).length;
  let intervalsTone: 'gray' | 'green' | 'amber' | 'red' = 'red';
  let intervalsValue = t('infrastructure.intervals.notConfigured');

  if (intervalsLoading) {
    intervalsTone = 'gray';
    intervalsValue = t('common.loading');
  } else if (intervalsStatus?.configured) {
    intervalsTone = 'green';
    intervalsValue = t('infrastructure.intervals.configured');
  } else if (intervalsStatus) {
    intervalsTone = 'gray';
    intervalsValue = t('infrastructure.intervals.notConfigured');
  }

  return (
    <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-md dark:border-sky-900/60 dark:bg-gray-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
            {t('infrastructure.overviewLabel', 'Monitoring')}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {t('infrastructure.title')}
          </h2>
        </div>
        <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-400">
          {t(
            'infrastructure.subtitle',
            'Vue opérationnelle des intégrations, exports vidéo et données cache.'
          )}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfrastructureStatCard
          label={t('infrastructure.tabs.intervals')}
          value={intervalsValue}
          detail={t('infrastructure.intervals.overviewDetail', {
            count: intervalsStatus?.activity_types.length ?? 0,
          })}
          tone={intervalsTone}
        />
        <InfrastructureStatCard
          label={t('infrastructure.tabs.videoExports')}
          value={t('infrastructure.videoExports.ready', 'File')}
          detail={t(
            'infrastructure.videoExports.description',
            'Suivi des exports et nettoyage des fichiers temporaires.'
          )}
          tone="amber"
        />
        <InfrastructureStatCard
          label={t('cache.totalKeys')}
          value={String(cacheOverview.total_keys)}
          detail={t('cache.groups') + `: ${String(cacheGroups)}`}
          tone={cacheOverview.truncated ? 'amber' : 'sky'}
        />
        <InfrastructureStatCard
          label={t('cache.memoryUsage')}
          value={cacheOverview.memory_usage ?? '—'}
          detail={
            cacheOverview.truncated
              ? t('cache.truncatedWarning')
              : t('cache.noResolution')
          }
          tone={cacheOverview.truncated ? 'amber' : 'gray'}
        />
      </div>
    </section>
  );
}

export default function InfrastructurePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { tab?: string };
  const search = useSearch({ strict: false }) as InfrastructureSearch;
  const { toasts, removeToast } = useToastStore();
  const { data: intervalsStatus } = useIntervalsStatus();
  const { data: cacheOverview } = useCacheOverview();
  const activeTab = normalizeInfrastructureTab(params.tab);
  let intervalsBadgeClassName =
    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  let intervalsBadgeLabel = t('common.loading');

  if (intervalsStatus?.configured) {
    intervalsBadgeClassName =
      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    intervalsBadgeLabel = t('infrastructure.intervals.configured');
  } else if (intervalsStatus) {
    intervalsBadgeClassName =
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    intervalsBadgeLabel = t('infrastructure.intervals.notConfigured');
  }

  const navigateToInfrastructure = (
    tab: InfrastructureTab,
    nextSearch: InfrastructureSearch = search
  ) => {
    void navigate({
      to: '/infrastructure/$tab',
      params: { tab },
      search: {
        cacheSearch: nextSearch.cacheSearch || undefined,
        cacheAutoRefresh: nextSearch.cacheAutoRefresh ? true : undefined,
      },
    });
  };

  const updateCacheSearch = (cacheSearch: string) => {
    navigateToInfrastructure(activeTab, {
      ...search,
      cacheSearch: cacheSearch || undefined,
    });
  };

  const updateCacheAutoRefresh = (cacheAutoRefresh: boolean) => {
    navigateToInfrastructure(activeTab, {
      ...search,
      cacheAutoRefresh: cacheAutoRefresh ? true : undefined,
    });
  };

  return (
    <div className="py-4 space-y-8">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <InfrastructureOverview />

      <Tabs
        className="space-y-4"
        selectedKey={activeTab}
        onSelectionChange={(key) =>
          navigateToInfrastructure(normalizeInfrastructureTab(key))
        }
      >
        <TabList className="grid-cols-1 sm:grid-cols-3">
          <Tab id="intervals">
            <span className="flex items-center justify-center gap-2">
              {t('infrastructure.tabs.intervals')}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${intervalsBadgeClassName}`}
              >
                {intervalsBadgeLabel}
              </span>
            </span>
          </Tab>
          <Tab id="video-exports">
            <span className="flex items-center justify-center gap-2">
              {t('infrastructure.tabs.videoExports')}
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {t('infrastructure.videoExports.ready', 'File')}
              </span>
            </span>
          </Tab>
          <Tab id="cache">
            <span className="flex items-center justify-center gap-2">
              {t('infrastructure.tabs.cache')}
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                {String(cacheOverview.total_keys)}
              </span>
            </span>
          </Tab>
        </TabList>

        <TabPanel id="intervals" className="outline-none">
          <IntervalsStatusSection />
        </TabPanel>
        <TabPanel id="video-exports" className="outline-none">
          <VideoExportJobsPanel limit={null} />
        </TabPanel>
        <TabPanel id="cache" className="outline-none">
          <CacheSection
            autoRefresh={search.cacheAutoRefresh === true}
            searchFilter={search.cacheSearch ?? ''}
            onAutoRefreshChange={updateCacheAutoRefresh}
            onSearchFilterChange={updateCacheSearch}
          />
        </TabPanel>
      </Tabs>
    </div>
  );
}

// =============================================================================
// CACHE GROUP TABLE (unchanged)
// =============================================================================

const columnHelper = createColumnHelper<CacheKeyInfo>();

function GroupSection({
  prefix,
  group,
  isExpanded,
  onToggle,
  onClearPattern,
  onViewKey,
  onDeleteKey,
  isPending,
}: {
  prefix: string;
  group: { count: number; keys: CacheKeyInfo[] };
  isExpanded: boolean;
  onToggle: () => void;
  onClearPattern: () => void;
  onViewKey: (key: string) => void;
  onDeleteKey: (key: string) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => buildCacheColumns({ t, onViewKey, onDeleteKey, isPending }),
    [t, onViewKey, onDeleteKey, isPending]
  );

  const table = useReactTable({
    data: group.keys,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <Button
          onPress={onToggle}
          variant="ghost"
          className="flex-1 flex items-center gap-3 min-w-0 justify-start"
        >
          <span
            className={`text-gray-400 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            &#9654;
          </span>
          <span className="font-mono text-sm font-medium text-gray-800 dark:text-gray-200">
            {prefix}
          </span>
          <span className="text-xs bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full">
            {group.count}
          </span>
        </Button>
        <Button
          onPress={onClearPattern}
          isDisabled={isPending}
          className="px-3 py-2 sm:px-2 sm:py-1 rounded text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {t('cache.clearPattern')}
        </Button>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <DataTable table={table} />
        </div>
      )}
    </div>
  );
  // oxlint-disable-next-line max-lines
  // oxlint-disable-next-line max-lines
}
