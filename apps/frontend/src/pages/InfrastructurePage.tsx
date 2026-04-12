import { useState, useMemo, useCallback } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTranslation } from 'react-i18next';
import { Checkbox, Input, TextField } from 'react-aria-components';
import { Button } from '@dashboard-parapente/design-system';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { DataTable, Modal } from '@dashboard-parapente/design-system';
import {
  useCacheOverview,
  useCacheKeyDetail,
  useDeleteCacheKey,
} from '../hooks/admin/useCache';
import type { CacheKeyInfo } from '../hooks/admin/useCache';
import {
  useStravaTokenStatus,
  useStravaTokenLogs,
  useStravaRefreshToken,
} from '../hooks/admin/useStravaToken';

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

function formatDate(iso: string): string {
  const normalizedIso =
    /Z$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  return new Date(normalizedIso).toLocaleString();
}

function getRefreshModeLabel(
  refreshMode: 'manual' | 'automatic' | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (refreshMode === 'manual') {
    return t('infrastructure.strava.manual');
  }
  if (refreshMode === 'automatic') {
    return t('infrastructure.strava.automatic');
  }
  return t('infrastructure.strava.modeUnknown');
}

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

  return t('cache.resolutionGeneric');
}

// =============================================================================
// STRAVA TOKEN SECTION
// =============================================================================

function StravaTokenSection() {
  const { t } = useTranslation();
  const {
    data: status,
    isLoading: statusLoading,
    isError: statusError,
  } = useStravaTokenStatus();
  const {
    data: logs,
    isLoading: logsLoading,
    isError: logsError,
  } = useStravaTokenLogs();
  const refreshMutation = useStravaRefreshToken();

  const refreshSucceeded =
    refreshMutation.isSuccess && refreshMutation.data?.refreshed === true;
  const refreshFailed =
    refreshMutation.isError ||
    (refreshMutation.isSuccess && refreshMutation.data?.refreshed === false);

  const statusBadge = (() => {
    if (statusLoading) return null;
    if (statusError || !status) {
      return {
        className:
          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
        label: t('infrastructure.strava.unknown'),
      };
    }
    return status.valid
      ? {
          className:
            'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
          label: t('infrastructure.strava.valid'),
        }
      : {
          className:
            'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
          label: t('infrastructure.strava.expired'),
        };
  })();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
        {t('infrastructure.strava.title')}
      </h3>

      {/* Status card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('infrastructure.strava.status')}:
          </span>
          {statusLoading ? (
            <span className="text-sm text-gray-400">...</span>
          ) : statusBadge ? (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          ) : null}
        </div>

        {status?.expires_at && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {t('infrastructure.strava.expiresAt')}:
            </span>
            <span className="text-gray-800 dark:text-gray-200">
              {formatDate(status.expires_at)}
            </span>
          </div>
        )}

        <Button
          onPress={() => refreshMutation.mutate()}
          isDisabled={refreshMutation.isPending}
          className="ml-auto px-3 py-1.5 rounded-md bg-orange-500 text-white text-sm hover:bg-orange-600 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {refreshMutation.isPending
            ? t('infrastructure.strava.refreshing')
            : t('infrastructure.strava.refresh')}
        </Button>
      </div>

      {/* Refresh success/error feedback */}
      {refreshSucceeded && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl p-3 text-sm text-green-800 dark:text-green-200">
          {t('infrastructure.strava.refreshSuccess')}
        </div>
      )}
      {refreshFailed && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-3 text-sm text-red-800 dark:text-red-200">
          {t('infrastructure.strava.refreshError')}
        </div>
      )}

      {/* Logs table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('infrastructure.strava.logs')}
          </h4>
        </div>
        {logsLoading ? (
          <div className="p-4 text-sm text-gray-400">...</div>
        ) : logsError ? (
          <div className="p-4 text-sm text-red-500 dark:text-red-400 text-center">
            {t('infrastructure.strava.unknown')}
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            {t('infrastructure.strava.noLogs')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                  <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">
                    {t('infrastructure.strava.date')}
                  </th>
                  <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">
                    {t('infrastructure.strava.status')}
                  </th>
                  <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">
                    {t('infrastructure.strava.mode')}
                  </th>
                  <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">
                    {t('infrastructure.strava.message')}
                  </th>
                  <th className="px-4 py-2 font-medium text-gray-500 dark:text-gray-400">
                    {t('infrastructure.strava.expiresAt')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-gray-100 dark:border-gray-700/50"
                  >
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.success
                            ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {log.success
                          ? t('infrastructure.strava.ok')
                          : t('infrastructure.strava.fail')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {getRefreshModeLabel(log.refresh_mode, t)}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-xs max-w-md truncate">
                      {log.message}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {log.expires_at ? formatDate(log.expires_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CACHE SECTION
// =============================================================================

function CacheSection() {
  const { t } = useTranslation();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
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
    if (!searchFilter) return overview.groups;

    const lower = searchFilter.toLowerCase();
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
  }, [overview, searchFilter, t]);

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
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
        {t('cache.title')}
      </h3>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md text-center">
          <div className="text-3xl font-bold text-sky-600">
            {overview.total_keys}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('cache.totalKeys')}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md text-center">
          <div className="text-3xl font-bold text-sky-600">
            {overview.memory_usage ?? '—'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('cache.memoryUsage')}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md text-center">
          <div className="text-3xl font-bold text-sky-600">
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
          onChange={setAutoRefresh}
          className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 group"
        >
          {({ isSelected }) => (
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
          onChange={setSearchFilter}
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

export default function InfrastructurePage() {
  const { t } = useTranslation();

  return (
    <div className="py-4 space-y-8">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        {t('infrastructure.title')}
      </h2>

      <StravaTokenSection />
      <CacheSection />
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
  const isMobile = useIsMobile();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columnVisibility: Record<string, boolean> = isMobile
    ? { ttl: false, size: false }
    : {};

  const columns = useMemo(
    () => [
      columnHelper.accessor('key', {
        header: t('cache.key'),
        cell: (info) => (
          <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate block max-w-xs">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('resolved', {
        header: t('cache.resolved'),
        cell: (info) => (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {getResolvedLabel(info.getValue(), t)}
          </span>
        ),
      }),
      columnHelper.accessor('ttl', {
        header: t('cache.ttl'),
        cell: (info) => (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {formatTtl(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('size', {
        header: t('cache.size'),
        cell: (info) => (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {formatSize(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: t('cache.actions'),
        cell: (info) => (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onPress={() => onViewKey(info.row.original.key)}
              className="min-h-11 px-3 py-2 sm:min-h-0 sm:px-2 sm:py-1 rounded text-xs bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors cursor-pointer"
            >
              {t('cache.view')}
            </Button>
            <Button
              onPress={() => onDeleteKey(info.row.original.key)}
              isDisabled={isPending}
              className="min-h-11 px-3 py-2 sm:min-h-0 sm:px-2 sm:py-1 rounded text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {t('cache.deleteKey')}
            </Button>
          </div>
        ),
      }),
    ],
    [t, onViewKey, onDeleteKey, isPending]
  );

  const table = useReactTable({
    data: group.keys,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            &#9654;
          </span>
          <span className="font-mono text-sm font-medium text-gray-800 dark:text-gray-200">
            {prefix}
          </span>
          <span className="text-xs bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full">
            {group.count}
          </span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            onPress={onClearPattern}
            isDisabled={isPending}
            className="px-3 py-2 sm:px-2 sm:py-1 rounded text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {t('cache.clearPattern')}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <DataTable table={table} />
        </div>
      )}
    </div>
  );
}
