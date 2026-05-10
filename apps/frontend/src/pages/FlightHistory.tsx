import { useState, useCallback, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { flightsQueryOptions } from '../hooks/flights/useFlights';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { Flight, Site } from '../types';
import type { RowSelectionState } from '@tanstack/react-table';
import { useSearch } from '@tanstack/react-router';
import { Input, TextField } from 'react-aria-components';
import {
  CheckSquare,
  FilePlus2,
  Search,
  Trash2,
  X,
  RefreshCw,
} from 'lucide-react';
import { StravaSyncModal } from '../components/flights/StravaSyncModal';
import { CreateFlightModal } from '../components/flights/CreateFlightModal';
import { CreateSiteModal } from '../components/flights/CreateSiteModal';
import { FlightsTable } from '../components/flights/FlightsTable';
import { FlightDetails } from '../components/flights/FlightDetails';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import {
  ToastContainer,
  Modal,
  Button,
} from '@dashboard-parapente/design-system';
import { useToast, useToastStore } from '../hooks/useToast';
import { HTTPError } from 'ky';
import { api } from '../lib/api';
import { useIsMobile } from '../hooks/useIsMobile';

export default function FlightHistory() {
  const { t } = useTranslation();
  const search = useSearch({ from: '/flights' });
  const { data: flights } = useSuspenseQuery(
    flightsQueryOptions({ limit: 50, siteId: search.siteId })
  );

  const isMobile = useIsMobile();

  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [flightToDelete, setFlightToDelete] = useState<Flight | null>(null);
  const [showMultiDeleteConfirm, setShowMultiDeleteConfirm] = useState(false);
  const [showStravaSyncModal, setShowStravaSyncModal] = useState(false);
  const [showCreateFlightModal, setShowCreateFlightModal] = useState(false);
  const [showCreateSiteModal, setShowCreateSiteModal] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gpxFilter, setGpxFilter] = useState<'all' | 'with' | 'missing'>('all');

  const filteredFlights = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return flights.filter((flight) => {
      const matchesSearch =
        normalizedQuery === '' ||
        flight.title?.toLowerCase().includes(normalizedQuery) ||
        flight.name?.toLowerCase().includes(normalizedQuery) ||
        flight.site_name?.toLowerCase().includes(normalizedQuery) ||
        flight.flight_date.includes(normalizedQuery);

      const matchesGpx =
        gpxFilter === 'all' ||
        (gpxFilter === 'with' && Boolean(flight.gpx_file_path)) ||
        (gpxFilter === 'missing' && !flight.gpx_file_path);

      return matchesSearch && matchesGpx;
    });
  }, [flights, searchQuery, gpxFilter]);

  const selectedFlight = flights.find((f: Flight) => f.id === selectedFlightId);
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const queryClient = useQueryClient();
  const toast = useToast();
  const { toasts, removeToast } = useToastStore();

  const handleSelectFlight = useCallback(
    (flight: Flight) => {
      setSelectedFlightId(flight.id);
      if (isMobile) {
        setShowMobileDetail(true);
      }
    },
    [isMobile]
  );

  const handleCloseMobileDetail = useCallback(() => {
    setShowMobileDetail(false);
    setSelectedFlightId(null);
  }, []);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setRowSelection({});
    setSelectedFlightId(null);
    setShowMobileDetail(false);
  }, []);

  const selectedFlightIds = Object.keys(rowSelection);
  const selectedCount = selectedFlightIds.length;

  const handleSelectAll = useCallback(() => {
    const allSelected: RowSelectionState = {};
    for (const flight of filteredFlights) {
      allSelected[flight.id] = true;
    }
    setRowSelection(allSelected);
  }, [filteredFlights]);

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

        for (const flightId of selectedFlightIds) {
          try {
            await api.delete(`flights/${flightId}`);
            successCount++;
          } catch (err) {
            console.error(`Failed to delete flight ${flightId}:`, err);
            failCount++;
          }
        }

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
          setSelectedFlightId(null);
          setShowMobileDetail(false);
        }
        setFlightToDelete(null);
      }
    } catch (err) {
      console.error('Failed to delete flight:', err);
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
    toast,
    queryClient,
    t,
  ]);

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
                        count: filteredFlights.length,
                      })
                    : t('flights.registered', {
                        count: filteredFlights.length,
                      })}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {!selectionMode && (
              <Button
                onClick={() => setShowCreateFlightModal(true)}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors flex items-center gap-2"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                {t('flights.createFlight')}
              </Button>
            )}

            {!selectionMode && (
              <Button
                onClick={() => setShowStravaSyncModal(true)}
                variant="secondary"
                className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t('flights.syncStrava')}
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
                  placeholder={t('flights.searchPlaceholder')}
                  className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </TextField>

            <select
              value={gpxFilter}
              onChange={(event) =>
                setGpxFilter(event.target.value as 'all' | 'with' | 'missing')
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
          <div className={isMobile ? '' : 'lg:col-span-1'}>
            <FlightsTable
              flights={filteredFlights}
              selectedFlightId={selectedFlightId}
              selectionMode={selectionMode}
              onSelectFlight={handleSelectFlight}
              onDeleteFlight={setFlightToDelete}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
            />
          </div>
        )}

        {/* Detail Panel + 3D Viewer (desktop) */}
        {!isMobile && (
          <div className="lg:col-span-2 space-y-4">
            {selectedFlightId && selectedFlight ? (
              <FlightDetails
                key={selectedFlightId}
                flight={selectedFlight}
                sites={sites}
                onShowCreateSiteModal={() => setShowCreateSiteModal(true)}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-md text-center">
                <p className="text-gray-600 dark:text-gray-300">
                  {t('flights.selectFlightHint')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Detail Panel + 3D Viewer (mobile) */}
        {isMobile && showMobileDetail ? (
          <div className="space-y-4">
            {selectedFlightId && selectedFlight ? (
              <FlightDetails
                key={selectedFlightId}
                flight={selectedFlight}
                sites={sites}
                onShowCreateSiteModal={() => setShowCreateSiteModal(true)}
                mobileMode
                onCloseMobile={handleCloseMobileDetail}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-md text-center">
                <p className="text-gray-600 dark:text-gray-300">
                  {t('flights.selectFlightHint')}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Modal Sync Strava */}
      <StravaSyncModal
        isOpen={showStravaSyncModal}
        onClose={() => setShowStravaSyncModal(false)}
        onSyncComplete={() => {
          void queryClient.invalidateQueries({ queryKey: ['flights'] });
        }}
      />

      {/* Modal Créer un vol depuis GPX */}
      <CreateFlightModal
        isOpen={showCreateFlightModal}
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
