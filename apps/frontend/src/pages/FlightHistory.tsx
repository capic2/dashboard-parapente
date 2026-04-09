import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { flightsQueryOptions } from '../hooks/flights/useFlights';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { Flight, Site } from '../types';
import type { RowSelectionState } from '@tanstack/react-table';
import { StravaSyncModal } from '../components/flights/StravaSyncModal';
import { CreateFlightModal } from '../components/flights/CreateFlightModal';
import { CreateSiteModal } from '../components/flights/CreateSiteModal';
import { FlightsTable } from '../components/flights/FlightsTable';
import { FlightDetails } from '../components/flights/FlightDetails';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { ToastContainer, Modal } from '@dashboard-parapente/design-system';
import { useToast, useToastStore } from '../hooks/useToast';
import { HTTPError } from 'ky';
import { api } from '../lib/api';

export default function FlightHistory() {
  const { t } = useTranslation();
  const { data: flights } = useSuspenseQuery(
    flightsQueryOptions({ limit: 50 })
  );

  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [flightToDelete, setFlightToDelete] = useState<Flight | null>(null);
  const [showMultiDeleteConfirm, setShowMultiDeleteConfirm] = useState(false);
  const [showStravaSyncModal, setShowStravaSyncModal] = useState(false);
  const [showCreateFlightModal, setShowCreateFlightModal] = useState(false);
  const [showCreateSiteModal, setShowCreateSiteModal] = useState(false);

  const selectedFlight = flights.find((f: Flight) => f.id === selectedFlightId);
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const queryClient = useQueryClient();
  const toast = useToast();
  const { toasts, removeToast } = useToastStore();

  const handleSelectFlight = useCallback((flight: Flight) => {
    setSelectedFlightId(flight.id);
  }, []);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setRowSelection({});
    setSelectedFlightId(null);
  }, []);

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
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('flights.history')}
            </h1>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {selectionMode && selectedCount > 0 ? (
                <span className="text-sky-600 font-semibold">
                  {t('flights.selected', { count: selectedCount })}
                </span>
              ) : (
                <>{t('flights.registered', { count: flights.length })}</>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {!selectionMode && (
              <button
                onClick={() => setShowCreateFlightModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center gap-2"
              >
                {t('flights.createFlight')}
              </button>
            )}

            {!selectionMode && (
              <button
                onClick={() => setShowStravaSyncModal(true)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all flex items-center gap-2"
              >
                {t('flights.syncStrava')}
              </button>
            )}

            <button
              onClick={handleToggleSelectionMode}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                selectionMode
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {selectionMode ? t('flights.cancel') : t('flights.select')}
            </button>
          </div>
        </div>

        {selectionMode && (
          <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              {t('flights.selectAll')}
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              {t('flights.deselectAll')}
            </button>
            <button
              onClick={() => setShowMultiDeleteConfirm(true)}
              disabled={selectedCount === 0}
              className="ml-auto px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {t('flights.deleteCount', { count: selectedCount })}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Flight List */}
        <div className="lg:col-span-1">
          <FlightsTable
            flights={flights}
            selectedFlightId={selectedFlightId}
            selectionMode={selectionMode}
            onSelectFlight={handleSelectFlight}
            onDeleteFlight={setFlightToDelete}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
          />
        </div>

        {/* Detail Panel + 3D Viewer */}
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
          {t('flights.confirmDeleteSinglePrefix')}{' '}
          <span className="font-bold text-red-600">
            {flightToDelete?.title || t('flights.untitledFlight')}
          </span>
          . {t('flights.confirmDeleteSingleSuffix')}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setFlightToDelete(null)}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleDeleteFlight}
            disabled={isDeleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isDeleting ? t('flights.deleting') : t('flights.deleteButton')}
          </button>
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
          <button
            onClick={() => setShowMultiDeleteConfirm(false)}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleDeleteFlight}
            disabled={isDeleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isDeleting
              ? t('flights.deleting')
              : t('flights.deleteButtonCount', { count: selectedCount })}
          </button>
        </div>
      </Modal>
    </div>
  );
}
