import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  getFinishedActiveFlightIds,
  mergeActiveMediaJobs,
  useActiveFlightMediaJobs,
  useFlightSummaries,
} from '../hooks/flights/useFlightSummaries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Site } from '../types';
import type { FlightSummary } from '@dashboard-parapente/shared-types';
import type { RowSelectionState, SortingState } from '@tanstack/react-table';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import {
  Button as AriaButton,
  Input,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  TextField,
} from 'react-aria-components';
import {
  CheckSquare,
  FilePlus2,
  Upload,
  Search,
  Trash2,
  X,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import { IntervalsSyncModal } from '../components/flights/intervals-sync/IntervalsSyncModal';
import { CreateFlightModal } from '../components/flights/create-flight/CreateFlightModal';
import { CreateSiteModal } from '../components/flights/create-site/CreateSiteModal';
import { FlightsTable } from '../components/flights/table/FlightsTable';
import { FlightDetails } from '../components/flights/details/FlightDetails';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { Modal, Button } from '@dashboard-parapente/design-system';
import { useToast } from '../hooks/useToast';
import { HTTPError } from 'ky';
import { api } from '../lib/api';
import { useIsMobile } from '../hooks/useIsMobile';
import { useFlight } from '../hooks/flights/useFlight';
import {
  normalizeFlightsSearch,
  serializeFlightsSearch,
  type FlightsSearch,
  type FlightsRouteSearch,
} from '../routes/-flightSearch';

function FlightListSkeleton() {
  return (
    <div aria-busy="true" className="space-y-2">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700"
        />
      ))}
    </div>
  );
}

function FlightDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      className="h-80 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700"
    />
  );
}

function FlightListError({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl bg-white p-8 text-center shadow-md dark:bg-gray-800">
      <p className="mb-4 text-gray-700 dark:text-gray-300">{message}</p>
      <Button onClick={onRetry}>{retryLabel}</Button>
    </div>
  );
}

function FlightSearchInput({
  initialQuery,
  onQueryChange,
}: {
  initialQuery: string;
  onQueryChange: (query: string) => void;
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query === initialQuery) return;
    const timeout = window.setTimeout(() => onQueryChange(query), 300);
    return () => window.clearTimeout(timeout);
  }, [initialQuery, onQueryChange, searchQuery]);

  return (
    <TextField
      value={searchQuery}
      onChange={setSearchQuery}
      aria-label={t('flights.searchPlaceholder')}
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <Input
          maxLength={200}
          placeholder={t('flights.searchPlaceholder')}
          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
    </TextField>
  );
}

export default function FlightHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const routeSearch = useSearch({ strict: false }) as FlightsRouteSearch;
  const search = normalizeFlightsSearch(routeSearch);
  const summariesQuery = useFlightSummaries(search);
  const activeJobsQuery = useActiveFlightMediaJobs();
  const flights = useMemo(
    () =>
      mergeActiveMediaJobs(
        summariesQuery.data?.pages.flatMap((page) => page.flights) ?? [],
        activeJobsQuery.data ?? []
      ),
    [summariesQuery.data, activeJobsQuery.data]
  );
  const totalFlights = summariesQuery.data?.pages[0]?.total ?? 0;

  const isMobile = useIsMobile();

  const selectedFlightId = params.flightId ?? null;
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [flightToDelete, setFlightToDelete] = useState<FlightSummary | null>(
    null
  );
  const [showMultiDeleteConfirm, setShowMultiDeleteConfirm] = useState(false);
  const [showIntervalsSyncModal, setShowIntervalsSyncModal] = useState(false);
  const [showCreateFlightModal, setShowCreateFlightModal] = useState(false);
  const [createFlightMode, setCreateFlightMode] = useState<'manual' | 'file'>(
    'file'
  );
  const [showCreateSiteModal, setShowCreateSiteModal] = useState(false);
  const showMobileDetail = Boolean(isMobile && selectedFlightId);
  const selectedFlightQuery = useFlight(selectedFlightId ?? '');
  const selectedFlight = selectedFlightQuery.data;
  const [isDeleting, setIsDeleting] = useState(false);
  const sitesQuery = useQuery(sitesQueryOptions());
  const sites = sitesQuery.data ?? [];
  const queryClient = useQueryClient();
  const toast = useToast();
  const previousActiveJobs = useRef(activeJobsQuery.data ?? []);

  const renderDetailPanel = (mobileMode: boolean) => {
    if (selectedFlightId && selectedFlight) {
      if (mobileMode) {
        return (
          <FlightDetails
            key={selectedFlightId}
            flight={selectedFlight}
            sites={sites}
            onShowCreateSiteModal={() => setShowCreateSiteModal(true)}
            mobileMode
            onCloseMobile={handleCloseMobileDetail}
          />
        );
      }

      return (
        <FlightDetails
          key={selectedFlightId}
          flight={selectedFlight}
          sites={sites}
          onShowCreateSiteModal={() => setShowCreateSiteModal(true)}
        />
      );
    }

    if (selectedFlightId && selectedFlightQuery.isPending) {
      return <FlightDetailSkeleton />;
    }

    if (selectedFlightId && selectedFlightQuery.isError) {
      return (
        <FlightListError
          message={t('flights.detailLoadError')}
          retryLabel={t('flights.retryDetail')}
          onRetry={() => void selectedFlightQuery.refetch()}
        />
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-md text-center">
        <p className="text-gray-600 dark:text-gray-300">
          {t('flights.selectFlightHint')}
        </p>
      </div>
    );
  };

  const renderListPanel = () => {
    if (summariesQuery.isPending) {
      return <FlightListSkeleton />;
    }

    if (summariesQuery.isError) {
      return (
        <FlightListError
          message={t('flights.listLoadError')}
          retryLabel={t('flights.retryList')}
          onRetry={() => void summariesQuery.refetch()}
        />
      );
    }

    return (
      <FlightsTable
        flights={flights}
        selectedFlightId={selectedFlightId}
        selectionMode={selectionMode}
        onSelectFlight={handleSelectFlight}
        onDeleteFlight={setFlightToDelete}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        sorting={[{ id: search.sort, desc: search.order === 'desc' }]}
        onSortingChange={(updater) => {
          const current: SortingState = [
            { id: search.sort, desc: search.order === 'desc' },
          ];
          const next =
            typeof updater === 'function' ? updater(current) : updater;
          const first = next[0];
          if (!first) return;
          void navigateWithSearch({
            ...search,
            sort: first.id as FlightsSearch['sort'],
            order: first.desc ? 'desc' : 'asc',
          });
        }}
        hasMoreFlights={summariesQuery.hasNextPage}
        isLoadingMore={summariesQuery.isFetchingNextPage}
        onLoadMore={() => void summariesQuery.fetchNextPage()}
      />
    );
  };

  useEffect(() => {
    if (!activeJobsQuery.data) return;
    const finishedFlightIds = getFinishedActiveFlightIds(
      previousActiveJobs.current,
      activeJobsQuery.data
    );
    previousActiveJobs.current = activeJobsQuery.data;
    if (finishedFlightIds.length === 0) return;
    void queryClient.invalidateQueries({
      queryKey: ['flights', 'summaries'],
    });
    for (const flightId of finishedFlightIds) {
      void queryClient.invalidateQueries({ queryKey: ['flights', flightId] });
    }
  }, [activeJobsQuery.data, queryClient]);

  const navigateWithSearch = useCallback(
    (nextSearch: FlightsSearch, flightId = selectedFlightId) => {
      if (flightId) {
        return navigate({
          to: '/flights/$flightId',
          params: { flightId },
          search: serializeFlightsSearch(nextSearch),
          replace: true,
        });
      }
      return navigate({
        to: '/flights',
        search: serializeFlightsSearch(nextSearch),
        replace: true,
      });
    },
    [navigate, selectedFlightId]
  );

  const handleSearchQueryChange = (query: string) => {
    void navigateWithSearch({ ...search, q: query || undefined });
  };

  const setSelectedFlightId = useCallback(
    (flightId: string | undefined) => {
      if (flightId) {
        void navigate({
          to: '/flights/$flightId',
          params: { flightId },
          search: serializeFlightsSearch(search),
        });
        return;
      }

      void navigate({
        to: '/flights',
        search: serializeFlightsSearch(search),
      });
    },
    [navigate, search]
  );

  const handleSelectFlight = useCallback(
    (flight: FlightSummary) => {
      setSelectedFlightId(flight.id);
    },
    [setSelectedFlightId]
  );

  const handleCloseMobileDetail = useCallback(() => {
    setSelectedFlightId(undefined);
  }, [setSelectedFlightId]);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setRowSelection({});
    setSelectedFlightId(undefined);
  }, [setSelectedFlightId]);

  const selectedFlightIds = Object.keys(rowSelection);
  const selectedCount = selectedFlightIds.length;

  const handleSelectAll = useCallback(() => {
    const allSelected: RowSelectionState = {};
    for (const flight of flights) {
      allSelected[flight.id] = true;
    }
    setRowSelection(allSelected);
  }, [flights]);

  const handleDeselectAll = useCallback(() => {
    setRowSelection({});
  }, []);

  const handleSiteCreated = useCallback(
    (newSite: Site) => {
      setShowCreateSiteModal(false);
      toast.success(t('flights.siteCreatedSuccess', { name: newSite.name }));
    },
    [toast, t]
  );

  const handleDeleteFlight = useCallback(async () => {
    setIsDeleting(true);
    try {
      if (selectionMode && selectedCount > 0) {
        let successCount = 0;
        let failCount = 0;

        const deleteResults = await Promise.allSettled(
          selectedFlightIds.map((flightId) => api.delete(`flights/${flightId}`))
        );
        successCount = deleteResults.filter(
          (result) => result.status === 'fulfilled'
        ).length;
        failCount = deleteResults.length - successCount;

        queryClient.invalidateQueries({ queryKey: ['flights'] });
        queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });

        if (failCount === 0) {
          toast.success(t('flights.deleted', { count: successCount }));
        } else {
          toast.error(
            t('flights.deletePartial', {
              success: successCount,
              fail: failCount,
              count: failCount,
            })
          );
        }

        setRowSelection({});
        setShowMultiDeleteConfirm(false);
      } else if (flightToDelete) {
        await api.delete(`flights/${flightToDelete.id}`);
        queryClient.invalidateQueries({ queryKey: ['flights'] });
        queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });
        toast.success(t('flights.deletedSuccess'));
        if (selectedFlightId === flightToDelete.id) {
          setSelectedFlightId(undefined);
        }
        setFlightToDelete(null);
      }
    } catch (err) {
      let errorMessage = t('flights.unknownError');
      if (err instanceof HTTPError) {
        try {
          const errorBody = await err.response.json();
          errorMessage = errorBody.message || errorBody.detail || err.message;
        } catch {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      toast.error(t('flights.deleteError', { error: errorMessage }));
    } finally {
      setIsDeleting(false);
    }
  }, [
    flightToDelete,
    selectedFlightId,
    selectedFlightIds,
    selectedCount,
    selectionMode,
    setSelectedFlightId,
    toast,
    queryClient,
    t,
  ]);

  return (
    <div>
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white">
            {t('flights.history')}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {search.siteId
              ? t('flights.registeredForSite', { count: totalFlights })
              : t('flights.registered', { count: totalFlights })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setCreateFlightMode('file');
              setShowCreateFlightModal(true);
            }}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 sm:flex-none"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t('flights.importFile')}
          </Button>
          <MenuTrigger>
            <AriaButton
              aria-label={t('flights.moreActions')}
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </AriaButton>
            <Popover className="z-40 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
              <Menu className="outline-none">
                <MenuItem
                  onAction={() => {
                    setCreateFlightMode('manual');
                    setShowCreateFlightModal(true);
                  }}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
                >
                  <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                  {t('flights.manualEntry')}
                </MenuItem>
                <MenuItem
                  onAction={() => setShowIntervalsSyncModal(true)}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t('flights.syncIntervals')}
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)]">
        {/* Flight List */}
        {(!isMobile || !showMobileDetail) && (
          <aside className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
            {!selectionMode ? (
              <div className="mb-3 space-y-2 border-b border-slate-200 pb-3 dark:border-slate-700">
                <FlightSearchInput
                  key={search.q ?? ''}
                  initialQuery={search.q ?? ''}
                  onQueryChange={handleSearchQueryChange}
                />
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <select
                    value={search.gpx}
                    onChange={(event) =>
                      void navigateWithSearch({
                        ...search,
                        gpx: event.target.value as FlightsSearch['gpx'],
                      })
                    }
                    aria-label={t('flights.gpxFilter')}
                    className="min-h-10 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="all">{t('flights.allGpxStatuses')}</option>
                    <option value="with">{t('flights.withGpx')}</option>
                    <option value="missing">{t('flights.withoutGpx')}</option>
                  </select>
                  <Button
                    variant="ghost"
                    onClick={handleToggleSelectionMode}
                    className="min-h-10 rounded-lg px-3 py-2 text-sm"
                  >
                    <CheckSquare className="h-4 w-4" aria-hidden="true" />
                    {t('flights.select')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/30">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                    {t('flights.selected', { count: selectedCount })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleSelectionMode}
                    aria-label={t('flights.cancel')}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {t('flights.selectAll')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDeselectAll}
                  >
                    {t('flights.deselectAll')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowMultiDeleteConfirm(true)}
                    isDisabled={selectedCount === 0}
                    className="ml-auto"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {t('flights.deleteCount', { count: selectedCount })}
                  </Button>
                </div>
              </div>
            )}
            {renderListPanel()}
          </aside>
        )}

        {/* Detail Panel + 3D Viewer (desktop) */}
        {!isMobile && (
          <main className="min-w-0 space-y-4">{renderDetailPanel(false)}</main>
        )}

        {/* Detail Panel + 3D Viewer (mobile) */}
        {isMobile && showMobileDetail ? (
          <div className="space-y-4">{renderDetailPanel(true)}</div>
        ) : null}
      </div>

      <IntervalsSyncModal
        isOpen={showIntervalsSyncModal}
        onClose={() => setShowIntervalsSyncModal(false)}
        onSyncComplete={() => {
          void queryClient.invalidateQueries({ queryKey: ['flights'] });
        }}
      />

      {/* Modal de création manuelle ou depuis un fichier de trace */}
      <CreateFlightModal
        isOpen={showCreateFlightModal}
        sites={sites}
        isSitesLoading={sitesQuery.isPending}
        hasSitesError={sitesQuery.isError}
        initialMode={createFlightMode}
        onClose={() => setShowCreateFlightModal(false)}
        onCreateComplete={() => {
          void queryClient.invalidateQueries({ queryKey: ['flights'] });
        }}
      />

      {/* Modal Créer un site */}
      <CreateSiteModal
        isOpen={showCreateSiteModal}
        onClose={() => setShowCreateSiteModal(false)}
        onSiteCreated={handleSiteCreated}
        flightId={selectedFlightId || undefined}
      />

      {/* Modal de confirmation suppression simple */}
      <Modal
        role="alertdialog"
        isOpen={flightToDelete !== null}
        onClose={() => setFlightToDelete(null)}
        title={t('flights.confirmDelete')}
        size="sm"
      >
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          <Trans
            i18nKey="flights.confirmDeleteSingleMessage"
            values={{
              title: flightToDelete?.title || t('flights.untitledFlight'),
            }}
            components={{
              title: (
                <span className="font-bold text-red-600 dark:text-red-400" />
              ),
            }}
          />
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            initialFocus
            onClick={() => setFlightToDelete(null)}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteFlight}
            isDisabled={isDeleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isDeleting ? t('flights.deleting') : t('flights.deleteButton')}
          </Button>
        </div>
      </Modal>

      {/* Modal de confirmation suppression multiple */}
      <Modal
        role="alertdialog"
        isOpen={showMultiDeleteConfirm && selectedCount > 0}
        onClose={() => setShowMultiDeleteConfirm(false)}
        title={t('flights.confirmDelete')}
        size="sm"
      >
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          {t('flights.confirmDeleteMulti', { count: selectedCount })}
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            initialFocus
            onClick={() => setShowMultiDeleteConfirm(false)}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteFlight}
            isDisabled={isDeleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isDeleting
              ? t('flights.deleting')
              : t('flights.deleteButtonCount', { count: selectedCount })}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
