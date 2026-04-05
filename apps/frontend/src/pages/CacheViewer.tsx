import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@dashboard-parapente/design-system';
import {
  useCacheOverview,
  useCacheKeyDetail,
  useDeleteCacheKey,
} from '../hooks/admin/useCache';
import type { CacheKeyInfo } from '../hooks/admin/useCache';

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

export default function CacheViewer() {
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
      const filteredKeys = group.keys.filter((k) =>
        k.key.toLowerCase().includes(lower)
      );
      if (filteredKeys.length > 0) {
        result[prefix] = { count: filteredKeys.length, keys: filteredKeys };
      }
    }
    return result;
  }, [overview, searchFilter]);

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
    <div className="py-4 space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        {t('cache.title')}
      </h2>

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

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded"
          />
          {t('cache.autoRefresh')}
        </label>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-3 py-1.5 rounded-md bg-sky-600 text-white text-sm hover:bg-sky-700 transition-colors"
        >
          {t('cache.refresh')}
        </button>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder={t('cache.searchPlaceholder')}
          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400"
        />
        <button
          type="button"
          onClick={handleClearAll}
          disabled={deleteMutation.isPending}
          className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {t('cache.clearAll')}
        </button>
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
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingConfirm.onConfirm();
                  setPendingConfirm(null);
                }}
                className="px-4 py-2 rounded-md text-sm text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
      >
        <div className="flex items-center gap-3">
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClearPattern();
          }}
          disabled={isPending}
          className="px-2 py-1 rounded text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50"
        >
          {t('cache.clearPattern')}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-750 text-left text-xs text-gray-500 dark:text-gray-400">
                <th className="px-4 py-2">{t('cache.key')}</th>
                <th className="px-4 py-2 w-24">{t('cache.ttl')}</th>
                <th className="px-4 py-2 w-24">{t('cache.size')}</th>
                <th className="px-4 py-2 w-32">{t('cache.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {group.keys.map((k) => (
                <tr
                  key={k.key}
                  className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-xs">
                    {k.key}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                    {formatTtl(k.ttl)}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                    {formatSize(k.size)}
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onViewKey(k.key)}
                      className="px-2 py-1 rounded text-xs bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors"
                    >
                      {t('cache.view')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteKey(k.key)}
                      disabled={isPending}
                      className="px-2 py-1 rounded text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50"
                    >
                      {t('cache.deleteKey')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
