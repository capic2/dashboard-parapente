import { useState, useCallback, useRef, lazy, Suspense } from 'react';
import {
  useFlights,
  useUpdateFlight,
  useUploadGPXToFlight,
} from '../hooks/useFlights';
import { useQueryClient } from '@tanstack/react-query';
import type { Flight, Site } from '../types';
const FlightViewer3D = lazy(() => import('../components/complex/FlightViewer3D').then(m => ({ default: m.FlightViewer3D })));
import { StravaSyncModal } from '../components/forms/StravaSyncModal';
import { CreateFlightModal } from '../components/forms/CreateFlightModal';
import { CreateSiteModal } from '../components/forms/CreateSiteModal';
import { useSites } from '../hooks/useSites';
import { ToastContainer, Modal } from '@dashboard-parapente/design-system';
import { useToast, useToastStore } from '../hooks/useToast';
import { HTTPError } from 'ky';
import { api } from '../lib/api';

export default function FlightHistory() {
  const { data: flightsRaw = [], isLoading, error } = useFlights({ limit: 50 });

  // Trier les vols par date (plus récent en premier) côté frontend en backup du tri backend
  const flights = [...flightsRaw].sort((a, b) => {
    const dateA = new Date(a.flight_date);
    const dateB = new Date(b.flight_date);
    return dateB.getTime() - dateA.getTime();
  });

  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [selectedFlightIds, setSelectedFlightIds] = useState<Set<string>>(
    new Set()
  );
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
  const { data: sites = [] } = useSites();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { toasts, removeToast } = useToastStore();

  const handleSelectFlight = useCallback(
    (flight: Flight) => {
      if (selectionMode) {
        // Mode sélection multiple : toggle la sélection
        setSelectedFlightIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(flight.id)) {
            newSet.delete(flight.id);
          } else {
            newSet.add(flight.id);
          }
          return newSet;
        });
      } else {
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
      }
    },
    [selectionMode]
  );

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setSelectedFlightIds(new Set());
    setSelectedFlightId(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedFlightIds(new Set(flights.map((f: Flight) => f.id)));
  }, [flights]);

  const handleDeselectAll = useCallback(() => {
    setSelectedFlightIds(new Set());
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
      toast.success('Vol mis à jour avec succès');
    } catch (err) {
      console.error('Failed to update flight:', err);
      toast.error('Échec de la mise à jour');
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
  ]);

  const handleSiteCreated = useCallback(
    (newSite: Site) => {
      setEditedSiteId(newSite.id);
      setShowCreateSiteModal(false);
      toast.success(`Site "${newSite.name}" créé avec succès`);
    },
    [toast]
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
      if (selectionMode && selectedFlightIds.size > 0) {
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
          toast.success(
            `${successCount} vol${successCount > 1 ? 's' : ''} supprimé${successCount > 1 ? 's' : ''} avec succès`
          );
        } else {
          toast.error(
            `${successCount} réussi${successCount > 1 ? 's' : ''}, ${failCount} échec${failCount > 1 ? 's' : ''}`
          );
        }

        setSelectedFlightIds(new Set());
        setShowMultiDeleteConfirm(false);
      } else if (flightToDelete) {
        // Suppression simple
        await api.delete(`flights/${flightToDelete.id}`);
        queryClient.invalidateQueries({ queryKey: ['flights'] });
        queryClient.invalidateQueries({ queryKey: ['flights', 'stats'] });
        toast.success('Vol supprimé avec succès');
        if (selectedFlightId === flightToDelete.id) {
          setSelectedFlightId(null);
        }
        setFlightToDelete(null);
      }
    } catch (err) {
      console.error('Failed to delete flight:', err);
      let errorMessage = 'Erreur inconnue';
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
      toast.error(`Échec de la suppression: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  }, [
    flightToDelete,
    selectedFlightId,
    selectedFlightIds,
    selectionMode,
    toast,
    queryClient,
  ]);

  const handleGPXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFlightId) return;

    const formData = new FormData();
    formData.append('gpx_file', file);

    uploadGPXMutation.mutate(formData, {
      onSuccess: () => {
        toast.success('GPX ajouté avec succès');
        queryClient.invalidateQueries({ queryKey: ['flights'] });
      },
      onError: (error: Error) => {
        toast.error(`Échec de l'upload: ${error.message}`);
      },
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded mb-4 w-1/3"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-600 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center max-w-md mx-auto">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-3">❌ Erreur</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Impossible de charger l&apos;historique des vols
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-all"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              🪂 Historique des Vols
            </h1>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {selectionMode && selectedFlightIds.size > 0 ? (
                <span className="text-sky-600 font-semibold">
                  {selectedFlightIds.size} vol
                  {selectedFlightIds.size > 1 ? 's' : ''} sélectionné
                  {selectedFlightIds.size > 1 ? 's' : ''}
                </span>
              ) : (
                <>
                  {flights.length} vol{flights.length > 1 ? 's' : ''} enregistré
                  {flights.length > 1 ? 's' : ''}
                </>
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
                📤 Créer un vol
              </button>
            )}

            {/* Bouton Sync Strava */}
            {!selectionMode && (
              <button
                onClick={() => setShowStravaSyncModal(true)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all flex items-center gap-2"
              >
                🔄 Sync Strava
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
              {selectionMode ? '✖️ Annuler' : '☑️ Sélectionner'}
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
              Tout sélectionner
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              Tout désélectionner
            </button>
            <button
              onClick={() => setShowMultiDeleteConfirm(true)}
              disabled={selectedFlightIds.size === 0}
              className="ml-auto px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              🗑️ Supprimer ({selectedFlightIds.size})
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Flight List */}
        <div className="lg:col-span-1 space-y-2">
          {flights.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center">
              <p className="text-gray-700 dark:text-gray-300 font-medium">Aucun vol enregistré</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Les vols Strava apparaîtront automatiquement ici
              </p>
            </div>
          ) : (
            flights.map((flight: Flight) => (
              <div
                key={flight.id}
                className={`group relative bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border-2 transition-all cursor-pointer ${
                  selectionMode && selectedFlightIds.has(flight.id)
                    ? 'border-sky-600 shadow-md bg-sky-50 dark:bg-sky-900/20'
                    : selectedFlightId === flight.id
                      ? 'border-sky-600 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-sky-400'
                }`}
                onClick={() => handleSelectFlight(flight)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === 'Enter' && handleSelectFlight(flight)
                }
                aria-label={`Sélectionner vol du ${new Date(flight.flight_date).toLocaleDateString('fr-FR')}`}
              >
                {/* Bouton supprimer au survol */}
                {!selectionMode && (
                  <button
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-200 hover:text-red-700 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFlightToDelete(flight);
                    }}
                    aria-label={`Supprimer le vol ${flight.title || 'sans titre'}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                )}
                <div className="flex justify-between items-start mb-2">
                  {/* Checkbox en mode sélection */}
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedFlightIds.has(flight.id)}
                      onChange={() => handleSelectFlight(flight)}
                      className="mr-2 mt-1 w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}

                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate flex-1">
                    {flight.title || 'Vol sans titre'}
                  </h3>

                  {/* Badge GPX manquant */}
                  {!flight.gpx_file_path && !selectionMode && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-full shrink-0">
                      📎 GPX manquant
                    </span>
                  )}
                </div>

                {/* Date et heure */}
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span className="font-medium">
                    {(() => {
                      // Parse date comme date locale pour éviter les problèmes de timezone
                      const [year, month, day] = flight.flight_date.split('-');
                      const localDate = new Date(
                        Number(year),
                        Number(month) - 1,
                        Number(day)
                      );
                      return localDate.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      });
                    })()}
                  </span>
                  {flight.departure_time && (
                    <span className="ml-2">
                      à{' '}
                      {new Date(flight.departure_time).toLocaleTimeString(
                        'fr-FR',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                  {flight.duration_minutes && (
                    <div className="flex items-center gap-1">
                      <span aria-hidden="true">⏱️</span>
                      <span>
                        {Math.floor(flight.duration_minutes / 60)}h
                        {flight.duration_minutes % 60}m
                      </span>
                    </div>
                  )}
                  {flight.distance_km && (
                    <div className="flex items-center gap-1">
                      <span aria-hidden="true">📏</span>
                      <span>{flight.distance_km.toFixed(1)} km</span>
                    </div>
                  )}
                  {flight.max_altitude_m && (
                    <div className="flex items-center gap-1">
                      <span aria-hidden="true">⛰️</span>
                      <span>{flight.max_altitude_m} m</span>
                    </div>
                  )}
                </div>
                {flight.site_id && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <span aria-hidden="true">📍</span>
                    <span className="truncate">
                      {flight.site_name || flight.site_id}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
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
                          Nom du vol (identifiant)
                        </label>
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="block w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                          placeholder="Ex: Arguel 14-08 21h08"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-300">
                          Titre du vol
                        </label>
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="block w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                          placeholder="Titre du vol"
                        />
                      </div>
                    </div>
                  ) : (
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedFlight.title || 'Vol sans titre'}
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
                            ? '⏳ Enregistrement...'
                            : '✓ Enregistrer'}
                        </button>
                        <button
                          className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
                          onClick={handleCancelEdit}
                        >
                          ✖ Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="px-3 py-1.5 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-all"
                          onClick={handleEnterEditMode}
                          aria-label="Éditer le vol"
                        >
                          ✏️ Modifier
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
                            <>⏳ Upload...</>
                          ) : selectedFlight.gpx_file_path ? (
                            <>🔄 Remplacer GPX</>
                          ) : (
                            <>📎 Ajouter GPX</>
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
                    <span className="text-xs text-gray-600 dark:text-gray-300">📅 Date</span>
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
                          return localDate.toLocaleDateString('fr-FR', {
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
                      🕐 Heure de départ
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
                            ).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'N/A'}
                      </span>
                    )}
                  </div>

                  {/* Site */}
                  <div className="col-span-2 md:col-span-3">
                    <span className="text-xs text-gray-600 dark:text-gray-300">📍 Site</span>
                    {editingMode ? (
                      <div className="flex gap-2 mt-1">
                        <select
                          value={editedSiteId}
                          onChange={(e) => setEditedSiteId(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600 dark:bg-gray-700 dark:text-gray-100"
                        >
                          <option value="">Non spécifié</option>
                          {sites.map((site: Site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowCreateSiteModal(true)}
                          className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 whitespace-nowrap"
                          title="Créer un nouveau site"
                        >
                          + Nouveau
                        </button>
                      </div>
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {selectedFlight.site_name ||
                          selectedFlight.site_id ||
                          'Non spécifié'}
                      </span>
                    )}
                  </div>

                  {/* Durée */}
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      ⏱️ Durée (min)
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
                      📏 Distance (km)
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
                      ⛰️ Altitude max (m)
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
                      📈 Dénivelé (m)
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
                      🏃 Vitesse max (km/h)
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
                    📝 Notes
                  </label>
                  {editingMode ? (
                    <textarea
                      id="flight-notes"
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      placeholder="Conditions, sensations, points à améliorer..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 resize-none dark:bg-gray-700 dark:text-gray-100"
                    />
                  ) : editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        id="flight-notes"
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder="Conditions, sensations, points à améliorer..."
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
                            ? '⏳ Enregistrement...'
                            : '✓ Enregistrer'}
                        </button>
                        <button
                          className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
                          onClick={() => {
                            setNotesText(selectedFlight.notes || '');
                            setEditingNotes(false);
                          }}
                        >
                          ✗ Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                      {selectedFlight.notes || 'Aucune note pour ce vol'}
                    </p>
                  )}
                </div>

                {/* Indicateur statut GPX */}
                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                  {selectedFlight.gpx_file_path ? (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                      <span className="text-xl">✅</span>
                      <div>
                        <p className="font-medium">Fichier GPX disponible</p>
                        <p className="text-xs text-green-600">
                          Visualisation 3D active
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 p-3 rounded-lg">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <p className="font-medium">Fichier GPX manquant</p>
                        <p className="text-xs text-orange-600">
                          Ajoutez un fichier GPX pour activer la visualisation
                          3D
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* 3D Viewer */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                <Suspense fallback={<div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">Chargement du viewer 3D...</div>}>
                  <FlightViewer3D
                    flightId={selectedFlightId}
                    flightTitle={
                      selectedFlight.title ||
                      `Vol du ${new Date(selectedFlight.flight_date).toLocaleDateString('fr-FR')}`
                    }
                  />
                </Suspense>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-md text-center">
              <p className="text-gray-600 dark:text-gray-300">
                📍 Sélectionnez un vol pour visualiser les détails et la
                trajectoire 3D
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
          queryClient.invalidateQueries({ queryKey: ['flights'] });
        }}
      />

      {/* Modal Créer un vol depuis GPX */}
      <CreateFlightModal
        isOpen={showCreateFlightModal}
        onClose={() => setShowCreateFlightModal(false)}
        onCreateComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['flights'] });
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
        isOpen={flightToDelete !== null}
        onClose={() => setFlightToDelete(null)}
        title="⚠️ Confirmer la suppression"
        size="sm"
      >
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Vous êtes sur le point de supprimer définitivement le vol{' '}
          <span className="font-bold text-red-600">
            {flightToDelete?.title || 'sans titre'}
          </span>
          . Cette action est irréversible.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setFlightToDelete(null)}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleDeleteFlight}
            disabled={isDeleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isDeleting ? '⏳ Suppression...' : '🗑️ Supprimer'}
          </button>
        </div>
      </Modal>

      {/* Modal de confirmation suppression multiple */}
      <Modal
        isOpen={showMultiDeleteConfirm && selectedFlightIds.size > 0}
        onClose={() => setShowMultiDeleteConfirm(false)}
        title="⚠️ Confirmer la suppression"
        size="sm"
      >
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Vous êtes sur le point de supprimer définitivement{' '}
          <span className="font-bold text-red-600">
            {selectedFlightIds.size} vol
            {selectedFlightIds.size > 1 ? 's' : ''}
          </span>
          . Cette action est irréversible.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowMultiDeleteConfirm(false)}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleDeleteFlight}
            disabled={isDeleting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isDeleting
              ? '⏳ Suppression...'
              : `🗑️ Supprimer ${selectedFlightIds.size} vol${selectedFlightIds.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
