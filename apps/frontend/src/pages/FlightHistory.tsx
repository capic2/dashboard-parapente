import {
  useState,
  useCallback,
  useRef,
  lazy,
  Suspense,
  ChangeEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  flightsQueryOptions,
  useUpdateFlight,
  useUploadGPXToFlight,
} from '../hooks/flights/useFlights';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { Flight, Site } from '../types';
import type { RowSelectionState } from '@tanstack/react-table';
const FlightViewer3D = lazy(() =>
  import('../components/flights/FlightViewer3D').then((m) => ({
    default: m.FlightViewer3D,
  }))
);
import { StravaSyncModal } from '../components/flights/StravaSyncModal';
import { CreateFlightModal } from '../components/flights/CreateFlightModal';
import { CreateSiteModal } from '../components/flights/CreateSiteModal';
import { FlightsTable } from '../components/flights/FlightsTable';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import { ToastContainer, Modal } from '@dashboard-parapente/design-system';
import { useToast, useToastStore } from '../hooks/useToast';
import { HTTPError } from 'ky';
import { api } from '../lib/api';

export default function FlightHistory() {
  const { t, i18n } = useTranslation();
  const { data: flights } = useSuspenseQuery(
    flightsQueryOptions({ limit: 50 })
  );

  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [editingMode, setEditingMode] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [flightToDelete, setFlightToDelete] = useState<Flight | null>(null);
  const [showMultiDeleteConfirm, setShowMultiDeleteConfirm] = useState(false);
  const [showStravaSyncModal, setShowStravaSyncModal] = useState(false);
  const [showCreateFlightModal, setShowCreateFlightModal] = useState(false);
  const [showCreateSiteModal, setShowCreateSiteModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // États pour les champs éditables
  const [editedName, setEditedName] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedSiteId, setEditedSiteId] = useState('');
  const [editedFlightDate, setEditedFlightDate] = useState('');
  const [editedDepartureTime, setEditedDepartureTime] = useState('');
  const [editedDuration, setEditedDuration] = useState(0);
  const [editedDistance, setEditedDistance] = useState(0);
  const [editedMaxAltitude, setEditedMaxAltitude] = useState(0);
  const [editedElevationGain, setEditedElevationGain] = useState(0);
  const [editedMaxSpeed, setEditedMaxSpeed] = useState(0);
  const [editedNotes, setEditedNotes] = useState('');

  const selectedFlight = flights.find((f: Flight) => f.id === selectedFlightId);
  const updateFlight = useUpdateFlight(selectedFlightId || undefined);
  const [isDeleting, setIsDeleting] = useState(false);
  const uploadGPXMutation = useUploadGPXToFlight(selectedFlightId || '');
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const queryClient = useQueryClient();
  const toast = useToast();
  const { toasts, removeToast } = useToastStore();

  const handleSelectFlight = useCallback((flight: Flight) => {
    // Mode normal : afficher les détails
    setSelectedFlightId(flight.id);
    setNotesText(flight.notes || '');
    setEditingNotes(false);
    setEditingMode(false);

    // Initialiser les champs éditables
    setEditedName(flight.name || '');
    setEditedTitle(flight.title || flight.name || '');
    setEditedSiteId(flight.site_id || '');
    setEditedFlightDate(flight.flight_date);
    setEditedDepartureTime(flight.departure_time || '');
    setEditedDuration(flight.duration_minutes || 0);
    setEditedDistance(flight.distance_km || 0);
    setEditedMaxAltitude(flight.max_altitude_m || 0);
    setEditedElevationGain(flight.elevation_gain_m || 0);
    setEditedMaxSpeed(flight.max_speed_kmh || 0);
    setEditedNotes(flight.notes || '');
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

  const handleEnterEditMode = useCallback(() => {
    if (!selectedFlight) return;
    setEditingMode(true);
    setEditedTitle(selectedFlight.title || selectedFlight.name || '');
    setEditedFlightDate(selectedFlight.flight_date);
    setEditedDepartureTime(selectedFlight.departure_time || '');
    setEditedDuration(selectedFlight.duration_minutes || 0);
    setEditedDistance(selectedFlight.distance_km || 0);
    setEditedMaxAltitude(selectedFlight.max_altitude_m || 0);
    setEditedElevationGain(selectedFlight.elevation_gain_m || 0);
    setEditedMaxSpeed(selectedFlight.max_speed_kmh || 0);
    setEditedNotes(selectedFlight.notes || '');
  }, [selectedFlight]);

  const handleCancelEdit = useCallback(() => {
    setEditingMode(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedFlight) return;

    try {
      await updateFlight.mutateAsync({
        name: editedName,
        title: editedTitle,
        site_id: editedSiteId || null,
        flight_date: editedFlightDate,
        departure_time: editedDepartureTime || null,
        duration_minutes: editedDuration,
        max_altitude_m: editedMaxAltitude,
        distance_km: editedDistance,
        elevation_gain_m: editedElevationGain,
        max_speed_kmh: editedMaxSpeed,
        notes: editedNotes,
      });
      setEditingMode(false);
      toast.success(t('flights.updateSuccess'));
    } catch (err) {
      console.error('Failed to update flight:', err);
      toast.error(t('flights.updateError'));
    }
  }, [
    selectedFlight,
    updateFlight,
    editedName,
    editedTitle,
    editedSiteId,
    editedFlightDate,
    editedDepartureTime,
    editedDuration,
    editedDistance,
    editedMaxAltitude,
    editedElevationGain,
    editedMaxSpeed,
    editedNotes,
    toast,
    t,
  ]);

  const handleSiteCreated = useCallback(
    (newSite: Site) => {
      setEditedSiteId(newSite.id);
      setShowCreateSiteModal(false);
      toast.success(t('flights.siteCreatedSuccess', { name: newSite.name }));
    },
    [toast, t]
  );

  const handleSaveNotes = useCallback(async () => {
    if (!selectedFlight) return;

    try {
      await updateFlight.mutateAsync({
        title: selectedFlight.title || '',
        site_id: selectedFlight.site_id || null,
        flight_date: selectedFlight.flight_date,
        duration_minutes: selectedFlight.duration_minutes || 0,
        max_altitude_m: selectedFlight.max_altitude_m || 0,
        distance_km: selectedFlight.distance_km || 0,
        elevation_gain_m: selectedFlight.elevation_gain_m || 0,
        notes: notesText,
      });
      setEditingNotes(false);
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  }, [selectedFlight, updateFlight, notesText]);

  const handleDeleteFlight = useCallback(async () => {
    setIsDeleting(true);
    try {
      if (selectionMode && selectedCount > 0) {
        // Suppression multiple
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
        // Suppression simple
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

  const handleGPXUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFlightId) return;

    const formData = new FormData();
    formData.append('gpx_file', file);

    uploadGPXMutation.mutate(formData, {
      onSuccess: () => {
        toast.success(t('flights.gpxAddedSuccess'));
        queryClient.invalidateQueries({ queryKey: ['flights'] });
      },
      onError: (error: Error) => {
        toast.error(t('flights.gpxUploadError', { error: error.message }));
      },
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
            {/* Bouton Créer un vol depuis GPX */}
            {!selectionMode && (
              <button
                onClick={() => setShowCreateFlightModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center gap-2"
              >
                {t('flights.createFlight')}
              </button>
            )}

            {/* Bouton Sync Strava */}
            {!selectionMode && (
              <button
                onClick={() => setShowStravaSyncModal(true)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all flex items-center gap-2"
              >
                {t('flights.syncStrava')}
              </button>
            )}

            {/* Bouton Mode Sélection */}
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

        {/* Actions de sélection multiple */}
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
            <>
              {/* Flight Details */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                <div className="flex justify-between items-start mb-4">
                  {editingMode ? (
                    <div className="flex-1 space-y-2">
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-300">
                          {t('flights.flightName')}
                        </label>
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="block w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                          placeholder={t('flights.flightNamePlaceholder')}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-300">
                          {t('flights.flightTitle')}
                        </label>
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="block w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                          placeholder={t('flights.flightTitle')}
                        />
                      </div>
                    </div>
                  ) : (
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedFlight.title || t('flights.untitledFlight')}
                    </h2>
                  )}

                  <div className="flex gap-2 ml-4">
                    {editingMode ? (
                      <>
                        <button
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-all disabled:opacity-50"
                          onClick={handleSaveEdit}
                          disabled={updateFlight.isPending}
                        >
                          {updateFlight.isPending
                            ? t('flights.saving')
                            : t('flights.saveButton')}
                        </button>
                        <button
                          className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
                          onClick={handleCancelEdit}
                        >
                          {t('flights.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="px-3 py-1.5 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-all"
                          onClick={handleEnterEditMode}
                          aria-label={t('flights.editFlight')}
                        >
                          {t('flights.editButton')}
                        </button>

                        {/* Bouton Upload GPX */}
                        <button
                          className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                            selectedFlight.gpx_file_path
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-orange-600 text-white hover:bg-orange-700'
                          }`}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadGPXMutation.isPending}
                        >
                          {uploadGPXMutation.isPending ? (
                            <>{t('flights.uploadInProgress')}</>
                          ) : selectedFlight.gpx_file_path ? (
                            <>{t('flights.replaceGpx')}</>
                          ) : (
                            <>{t('flights.addGpx')}</>
                          )}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Input file caché */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".gpx"
                    onChange={handleGPXUpload}
                    className="hidden"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  {/* Date */}
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {t('flights.dateLabel')}
                    </span>
                    {editingMode ? (
                      <input
                        type="date"
                        value={editedFlightDate}
                        onChange={(e) => setEditedFlightDate(e.target.value)}
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {(() => {
                          // Parse date comme date locale pour éviter les problèmes de timezone
                          const [year, month, day] =
                            selectedFlight.flight_date.split('-');
                          const localDate = new Date(
                            Number(year),
                            Number(month) - 1,
                            Number(day)
                          );
                          return localDate.toLocaleDateString(i18n.language, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          });
                        })()}
                      </span>
                    )}
                  </div>

                  {/* Heure de départ */}
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {t('flights.departureTime')}
                    </span>
                    {editingMode ? (
                      <input
                        type="time"
                        value={
                          editedDepartureTime
                            ? new Date(editedDepartureTime).toLocaleTimeString(
                                'en-GB',
                                { hour: '2-digit', minute: '2-digit' }
                              )
                            : ''
                        }
                        onChange={(e) => {
                          if (e.target.value) {
                            const [hours, minutes] = e.target.value.split(':');
                            const newDateTime = new Date(editedFlightDate);
                            newDateTime.setHours(
                              parseInt(hours),
                              parseInt(minutes),
                              0,
                              0
                            );
                            setEditedDepartureTime(newDateTime.toISOString());
                          } else {
                            setEditedDepartureTime('');
                          }
                        }}
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {selectedFlight.departure_time
                          ? new Date(
                              selectedFlight.departure_time
                            ).toLocaleTimeString(i18n.language, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'N/A'}
                      </span>
                    )}
                  </div>

                  {/* Site */}
                  <div className="col-span-2 md:col-span-3">
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {t('flights.siteLabel')}
                    </span>
                    {editingMode ? (
                      <div className="flex gap-2 mt-1">
                        <select
                          value={editedSiteId}
                          onChange={(e) => setEditedSiteId(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="">{t('flights.notSpecified')}</option>
                          {sites.map((site: Site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowCreateSiteModal(true)}
                          className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 whitespace-nowrap"
                          title={t('flights.createNewSite')}
                        >
                          {t('flights.newSiteButton')}
                        </button>
                      </div>
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {selectedFlight.site_name ||
                          selectedFlight.site_id ||
                          t('flights.notSpecified')}
                      </span>
                    )}
                  </div>

                  {/* Durée */}
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {t('flights.durationLabel')}
                    </span>
                    {editingMode ? (
                      <input
                        type="number"
                        value={editedDuration}
                        onChange={(e) =>
                          setEditedDuration(Number(e.target.value))
                        }
                        min="0"
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {selectedFlight.duration_minutes ? (
                          <>
                            {Math.floor(selectedFlight.duration_minutes / 60)}h{' '}
                            {selectedFlight.duration_minutes % 60}m
                          </>
                        ) : (
                          'N/A'
                        )}
                      </span>
                    )}
                  </div>

                  {/* Distance */}
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {t('flights.distanceLabel')}
                    </span>
                    {editingMode ? (
                      <input
                        type="number"
                        value={editedDistance}
                        onChange={(e) =>
                          setEditedDistance(Number(e.target.value))
                        }
                        min="0"
                        step="0.1"
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {selectedFlight.distance_km?.toFixed(2)} km
                      </span>
                    )}
                  </div>

                  {/* Altitude max */}
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {t('flights.maxAltitudeLabel')}
                    </span>
                    {editingMode ? (
                      <input
                        type="number"
                        value={editedMaxAltitude}
                        onChange={(e) =>
                          setEditedMaxAltitude(Number(e.target.value))
                        }
                        min="0"
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {selectedFlight.max_altitude_m} m
                      </span>
                    )}
                  </div>

                  {/* Dénivelé */}
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {t('flights.elevationGainLabel')}
                    </span>
                    {editingMode ? (
                      <input
                        type="number"
                        value={editedElevationGain}
                        onChange={(e) =>
                          setEditedElevationGain(Number(e.target.value))
                        }
                        min="0"
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {selectedFlight.elevation_gain_m} m
                      </span>
                    )}
                  </div>

                  {/* Vitesse max */}
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {t('flights.maxSpeedLabel')}
                    </span>
                    {editingMode ? (
                      <input
                        type="number"
                        value={editedMaxSpeed}
                        onChange={(e) =>
                          setEditedMaxSpeed(Number(e.target.value))
                        }
                        min="0"
                        step="0.1"
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {selectedFlight.max_speed_kmh?.toFixed(2)} km/h
                      </span>
                    )}
                  </div>
                </div>

                {/* Notes Editor */}
                <div>
                  <label
                    htmlFor="flight-notes"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block"
                  >
                    {t('flights.notesLabel')}
                  </label>
                  {editingMode ? (
                    <textarea
                      id="flight-notes"
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      placeholder={t('flights.notesPlaceholder')}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 resize-none dark:bg-gray-700 dark:text-gray-100"
                    />
                  ) : editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        id="flight-notes"
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder={t('flights.notesPlaceholder')}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 resize-none dark:bg-gray-700 dark:text-gray-100"
                      />
                      <div className="flex gap-2">
                        <button
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-all disabled:opacity-50"
                          onClick={handleSaveNotes}
                          disabled={updateFlight.isPending}
                        >
                          {updateFlight.isPending
                            ? t('flights.saving')
                            : t('flights.saveButton')}
                        </button>
                        <button
                          className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
                          onClick={() => {
                            setNotesText(selectedFlight.notes || '');
                            setEditingNotes(false);
                          }}
                        >
                          {t('flights.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                      {selectedFlight.notes || t('flights.noNotes')}
                    </p>
                  )}
                </div>

                {/* Indicateur statut GPX */}
                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                  {selectedFlight.gpx_file_path ? (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                      <span className="text-xl">✅</span>
                      <div>
                        <p className="font-medium">
                          {t('flights.gpxAvailable')}
                        </p>
                        <p className="text-xs text-green-600">
                          {t('flights.viewer3dActive')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 p-3 rounded-lg">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <p className="font-medium">
                          {t('flights.gpxMissingDetail')}
                        </p>
                        <p className="text-xs text-orange-600">
                          {t('flights.gpxMissingHint')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3D Viewer */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                <Suspense
                  fallback={
                    <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      {t('flights.loading3dViewer')}
                    </div>
                  }
                >
                  <FlightViewer3D
                    flightId={selectedFlightId}
                    flightTitle={
                      selectedFlight.title ||
                      t('flights.flightOf', {
                        date: new Date(
                          selectedFlight.flight_date
                        ).toLocaleDateString(i18n.language),
                      })
                    }
                  />
                </Suspense>
              </div>
            </>
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
