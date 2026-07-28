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
import { Input, TextField } from 'react-aria-components';
import {
  CheckSquare,
  FilePlus2,
  Upload,
  Search,
  Trash2,
  X,
  RefreshCw,
} from 'lucide-react';
import { IntervalsSyncModal } from '../components/flights/intervals-sync/IntervalsSyncModal';
import { CreateFlightModal } from '../components/flights/create-flight/CreateFlightModal';
import { CreateSiteModal } from '../components/flights/create-site/CreateSiteModal';
import { FlightsTable } from '../components/flights/table/FlightsTable';
import { FlightDetails } from '../components/flights/details/FlightDetails';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import {
  ToastContainer,
  Modal,
  Button,
} from '@dashboard-parapente/design-system';
import { useToast, useToastStore } from '../hooks/useToast';
import { HTTPError } from 'ky';
import { api, getApiErrorMessage } from '../lib/api';
import { useIsMobile } from '../hooks/useIsMobile';
import { isUnavailableMediaError } from '../lib/flightMediaState';
import { useFlight } from '../hooks/flights/useFlight';
import {
  normalizeFlightsSearch,
  serializeFlightsSearch,
  type FlightsSearch,
  type FlightsRouteSearch,
} from '../routes/-flightSearch';

type DownloadingFlightMedia = {
  flightId: string;
  type: 'gpx' | 'video' | 'overlay';
};

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

function getFlightDownloadName(flight: FlightSummary, extension: string) {
  const rawName = flight.title?.trim() || flight.name?.trim() || flight.id;
  const filename = rawName.replace(/[^a-zA-Z0-9._-]+/gu, '_');

  return `${filename || flight.id}.${extension}`;
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
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState(search.q ?? '');
  const [downloadingFlightMedia, setDownloadingFlightMedia] =
    useState<DownloadingFlightMedia | null>(null);
  const [unavailableMedia, setUnavailableMedia] = useState<Set<string>>(
    () => new Set()
  );
  const selectedFlightQuery = useFlight(selectedFlightId ?? '');
  const selectedFlight = selectedFlightQuery.data;
  const [isDeleting, setIsDeleting] = useState(false);
  const sitesQuery = useQuery(sitesQueryOptions());
  const sites = sitesQuery.data ?? [];
  const queryClient = useQueryClient();
  const toast = useToast();
  const { toasts, removeToast } = useToastStore();
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
      <>
        <FlightsTable
          flights={flights}
          selectedFlightId={selectedFlightId}
          selectionMode={selectionMode}
          onSelectFlight={handleSelectFlight}
          onDeleteFlight={setFlightToDelete}
          onDownloadGpx={handleDownloadFlightGpx}
          onDownloadVideo={handleDownloadFlightVideo}
          onDownloadOverlay={handleDownloadFlightOverlay}
          downloadingMedia={downloadingFlightMedia}
          unavailableMedia={unavailableMedia}
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
        />
        {summariesQuery.hasNextPage && (
          <Button
            className="mt-3 w-full"
            isDisabled={summariesQuery.isFetchingNextPage}
            onClick={() => void summariesQuery.fetchNextPage()}
          >
            {summariesQuery.isFetchingNextPage
              ? t('flights.loadingMore')
              : t('flights.loadMore')}
          </Button>
        )}
      </>
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

  useEffect(() => {
    setUnavailableMedia(new Set());
  }, [summariesQuery.dataUpdatedAt]);

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

  useEffect(() => {
    setSearchQuery(search.q ?? '');
  }, [search.q]);

  useEffect(() => {
    const q = searchQuery.trim() || undefined;
    if (q === search.q) return;
    const timeout = window.setTimeout(() => {
      void navigateWithSearch({ ...search, q });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [navigateWithSearch, search, searchQuery]);

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

  useEffect(() => {
    if (isMobile && selectedFlightId) {
      setShowMobileDetail(true);
    }
  }, [isMobile, selectedFlightId]);

  const handleSelectFlight = useCallback(
    (flight: FlightSummary) => {
      setSelectedFlightId(flight.id);
      if (isMobile) {
        setShowMobileDetail(true);
      }
    },
    [isMobile, setSelectedFlightId]
  );

  const handleCloseMobileDetail = useCallback(() => {
    setShowMobileDetail(false);
    setSelectedFlightId(undefined);
  }, [setSelectedFlightId]);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setRowSelection({});
    setSelectedFlightId(undefined);
    setShowMobileDetail(false);
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
          setShowMobileDetail(false);
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

  const handleDownloadFlightGpx = useCallback(
    async (flight: FlightSummary) => {
      if (!flight.has_gpx || downloadingFlightMedia) return;

      setDownloadingFlightMedia({ flightId: flight.id, type: 'gpx' });
      try {
        const blob = await api.get(`flights/${flight.id}/gpx`).blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getFlightDownloadName(flight, 'gpx');
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        if (isUnavailableMediaError(error)) {
          setUnavailableMedia((current) =>
            new Set(current).add(`${flight.id}:gpx`)
          );
        }
        toast.error(t('flights.gpxDownloadError'));
      } finally {
        setDownloadingFlightMedia(null);
      }
    },
    [downloadingFlightMedia, t, toast]
  );

  const handleDownloadFlightVideo = useCallback(
    async (flight: FlightSummary) => {
      if (!flight.has_video || downloadingFlightMedia) {
        return;
      }

      setDownloadingFlightMedia({ flightId: flight.id, type: 'video' });
      try {
        const blob = await api
          .get(`flights/${flight.id}/video`, {
            timeout: false,
          })
          .blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getFlightDownloadName(flight, 'mp4');
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        if (isUnavailableMediaError(error)) {
          setUnavailableMedia((current) =>
            new Set(current).add(`${flight.id}:video`)
          );
        }
        toast.error(
          await getApiErrorMessage(
            error,
            t('flights.viewer.videoDownloadError')
          )
        );
      } finally {
        setDownloadingFlightMedia(null);
      }
    },
    [downloadingFlightMedia, t, toast]
  );

  const handleDownloadFlightOverlay = useCallback(
    async (flight: FlightSummary) => {
      if (!flight.has_gopro_overlay || downloadingFlightMedia) return;

      setDownloadingFlightMedia({ flightId: flight.id, type: 'overlay' });
      try {
        const blob = await api
          .get(`flights/${flight.id}/gopro-overlay`, {
            timeout: false,
          })
          .blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getFlightDownloadName(flight, 'mp4');
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        if (isUnavailableMediaError(error)) {
          setUnavailableMedia((current) =>
            new Set(current).add(`${flight.id}:overlay`)
          );
        }
        toast.error(
          await getApiErrorMessage(
            error,
            t('flights.goproOverlayDownloadError')
          )
        );
      } finally {
        setDownloadingFlightMedia(null);
      }
    },
    [downloadingFlightMedia, t, toast]
  );

  return (
    <div>
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('flights.history')}
            </h1>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {selectionMode && selectedCount > 0 ? (
                <span className="text-sky-600 dark:text-sky-400 font-semibold">
                  {t('flights.selected', { count: selectedCount })}
                </span>
              ) : (
                <span>
                  {search.siteId
                    ? t('flights.registeredForSite', {
                        count: totalFlights,
                      })
                    : t('flights.registered', {
                        count: totalFlights,
                      })}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {!selectionMode && (
              <Button
                onClick={() => {
                  setCreateFlightMode('file');
                  setShowCreateFlightModal(true);
                }}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors flex items-center gap-2"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {t('flights.importFile')}
              </Button>
            )}

            {!selectionMode && (
              <Button
                onClick={() => {
                  setCreateFlightMode('manual');
                  setShowCreateFlightModal(true);
                }}
                variant="secondary"
                className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                {t('flights.manualEntry')}
              </Button>
            )}

            {!selectionMode && (
              <Button
                onClick={() => setShowIntervalsSyncModal(true)}
                variant="secondary"
                className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t('flights.syncIntervals')}
              </Button>
            )}

            <Button
              onClick={handleToggleSelectionMode}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                selectionMode
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-white text-sky-700 border border-sky-200 hover:bg-sky-50 dark:bg-gray-800 dark:text-sky-300 dark:border-sky-800 dark:hover:bg-sky-950/40'
              }`}
            >
              {selectionMode ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <CheckSquare className="h-4 w-4" aria-hidden="true" />
              )}
              {selectionMode ? t('flights.cancel') : t('flights.select')}
            </Button>
          </div>
        </div>

        {!selectionMode && (
          <div className="grid grid-cols-1 gap-3 border-t border-gray-200 pt-3 dark:border-gray-700 md:grid-cols-[minmax(0,1fr)_220px]">
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
                  className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </TextField>

            <select
              value={search.gpx}
              onChange={(event) =>
                void navigateWithSearch({
                  ...search,
                  gpx: event.target.value as FlightsSearch['gpx'],
                })
              }
              aria-label={t('flights.gpxFilter')}
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="all">{t('flights.allGpxStatuses')}</option>
              <option value="with">{t('flights.withGpx')}</option>
              <option value="missing">{t('flights.withoutGpx')}</option>
            </select>
          </div>
        )}

        {selectionMode && (
          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleSelectAll}
              className="px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              {t('flights.selectAll')}
            </Button>
            <Button
              onClick={handleDeselectAll}
              className="px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              {t('flights.deselectAll')}
            </Button>
            <Button
              onClick={() => setShowMultiDeleteConfirm(true)}
              isDisabled={selectedCount === 0}
              className="ml-0 sm:ml-auto px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('flights.deleteCount', { count: selectedCount })}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Flight List */}
        {(!isMobile || !showMobileDetail) && (
          <div className={isMobile ? '' : 'lg:col-span-1 lg:h-full'}>
            {renderListPanel()}
          </div>
        )}

        {/* Detail Panel + 3D Viewer (desktop) */}
        {!isMobile && (
          <div className="lg:col-span-2 space-y-4">
            {renderDetailPanel(false)}
          </div>
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
