import { useState, useCallback, useRef } from 'react';
import {
  useFlights,
  useUpdateFlight,
  useDeleteFlight,
  useUploadGPXToFlight,
} from '../hooks/useFlights';
import { useQueryClient } from '@tanstack/react-query';
import type { Flight, Site } from '../types';
import { FlightViewer3D } from '../components/complex/FlightViewer3D';
import { StravaSyncModal } from '../components/forms/StravaSyncModal';
import { CreateFlightModal } from '../components/forms/CreateFlightModal';
import { CreateSiteModal } from '../components/forms/CreateSiteModal';
import { useSites } from '../hooks/useSites';
import { ToastContainer } from '@dashboard-parapente/design-system';
import { useToast, useToastStore } from '../hooks/useToast';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
  const deleteFlight = useDeleteFlight(selectedFlightId || undefined);
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
        setShowDeleteConfirm(false);

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
    if (selectionMode && selectedFlightIds.size > 0) {
      // Suppression multiple
      try {
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

        // Invalider le cache
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
        setShowDeleteConfirm(false);
      } catch (err) {
        console.error('Failed to delete flights:', err);
        toast.error('Échec de la suppression');
      }
    } else if (selectedFlightId) {
      // Suppression simple
      try {
        await deleteFlight.mutateAsync();
        toast.success('Vol supprimé avec succès');
        setSelectedFlightId(null);
        setShowDeleteConfirm(false);
      } catch (err) {
        console.error('Failed to delete flight:', err);
        toast.error(
          `Échec de la suppression: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
        );
      }
    }
  }, [
    selectedFlightId,
    selectedFlightIds,
    selectionMode,
    deleteFlight,
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
        <div className="bg-white rounded-xl p-8 shadow-md animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="bg-white rounded-xl p-8 shadow-md text-center max-w-md mx-auto">
          <h2 className="text-xl font-bold text-red-600 mb-3">❌ Erreur</h2>
          <p className="text-gray-700 mb-4">
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

      <div className="mb-4 bg-white rounded-xl p-4 shadow-md">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              🪂 Historique des Vols
            </h1>
            <div className="text-sm text-gray-600 mt-1">
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
          <div className="flex gap-2 pt-3 border-t border-gray-200">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
            >
              Tout sélectionner
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
            >
              Tout désélectionner
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
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
            <div className="bg-white rounded-xl p-8 shadow-md text-center">
              <p className="text-gray-700 font-medium">Aucun vol enregistré</p>
              <p className="text-sm text-gray-500 mt-2">
                Les vols Strava apparaîtront automatiquement ici
              </p>
            </div>
          ) : (
            flights.map((flight: Flight) => (
              <div
                key={flight.id}
                className={`bg-white rounded-lg p-3 shadow-sm border-2 transition-all cursor-pointer ${
                  selectionMode && selectedFlightIds.has(flight.id)
                    ? 'border-sky-600 shadow-md bg-sky-50'
                    : selectedFlightId === flight.id
                      ? 'border-sky-600 shadow-md'
                      : 'border-gray-200 hover:border-sky-400'
                }`}
                onClick={() => handleSelectFlight(flight)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === 'Enter' && handleSelectFlight(flight)
                }
                aria-label={`Sélectionner vol du ${new Date(flight.flight_date).toLocaleDateString('fr-FR')}`}
              >
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

                  <h3 className="font-semibold text-sm text-gray-900 truncate flex-1">
                    {flight.title || 'Vol sans titre'}
                  </h3>

                  {/* Badge GPX manquant */}
                  {!flight.gpx_file_path && !selectionMode && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full shrink-0">
                      📎 GPX manquant
                    </span>
                  )}
                </div>

                {/* Date et heure */}
                <div className="text-xs text-gray-500 mb-2">
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

                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
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
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
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
              <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="flex justify-between items-start mb-4">
                  {editingMode ? (
                    <div className="flex-1 space-y-2">
                      <div>
                        <label className="text-xs text-gray-600">
                          Nom du vol (identifiant)
                        </label>
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
                          placeholder="Ex: Arguel 14-08 21h08"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">
                          Titre du vol
                        </label>
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
                          placeholder="Titre du vol"
                        />
                      </div>
                    </div>
                  ) : (
                    <h2 className="text-lg font-bold text-gray-900">
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
                          className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all"
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

                        <button
                          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-all"
                          onClick={() => setShowDeleteConfirm(true)}
                          aria-label="Supprimer le vol"
                        >
                          🗑️ Supprimer
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
                    <span className="text-xs text-gray-600">📅 Date</span>
                    {editingMode ? (
                      <input
                        type="date"
                        value={editedFlightDate}
                        onChange={(e) => setEditedFlightDate(e.target.value)}
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 mt-1">
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
                    <span className="text-xs text-gray-600">
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
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 mt-1">
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
                    <span className="text-xs text-gray-600">📍 Site</span>
                    {editingMode ? (
                      <div className="flex gap-2 mt-1">
                        <select
                          value={editedSiteId}
                          onChange={(e) => setEditedSiteId(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
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
                      <span className="block text-sm font-medium text-gray-900 mt-1">
                        {selectedFlight.site_name ||
                          selectedFlight.site_id ||
                          'Non spécifié'}
                      </span>
                    )}
                  </div>

                  {/* Durée */}
                  <div>
                    <span className="text-xs text-gray-600">
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
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 mt-1">
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
                    <span className="text-xs text-gray-600">
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
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 mt-1">
                        {selectedFlight.distance_km?.toFixed(2)} km
                      </span>
                    )}
                  </div>

                  {/* Altitude max */}
                  <div>
                    <span className="text-xs text-gray-600">
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
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 mt-1">
                        {selectedFlight.max_altitude_m} m
                      </span>
                    )}
                  </div>

                  {/* Dénivelé */}
                  <div>
                    <span className="text-xs text-gray-600">
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
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 mt-1">
                        {selectedFlight.elevation_gain_m} m
                      </span>
                    )}
                  </div>

                  {/* Vitesse max */}
                  <div>
                    <span className="text-xs text-gray-600">
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
                        className="block w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    ) : (
                      <span className="block text-sm font-medium text-gray-900 mt-1">
                        {selectedFlight.max_speed_kmh?.toFixed(2)} km/h
                      </span>
                    )}
                  </div>
                </div>

                {/* Notes Editor */}
                <div>
                  <label
                    htmlFor="flight-notes"
                    className="text-sm font-semibold text-gray-700 mb-2 block"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 resize-none"
                    />
                  ) : editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        id="flight-notes"
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder="Conditions, sensations, points à améliorer..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 resize-none"
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
                          className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all"
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
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {selectedFlight.notes || 'Aucune note pour ce vol'}
                    </p>
                  )}
                </div>

                {/* Indicateur statut GPX */}
                <div className="mt-4 pt-4 border-t">
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

                {/* Delete Confirmation */}
                {showDeleteConfirm && !selectionMode && (
                  <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-700 mb-3">
                      ⚠️ Supprimer ce vol définitivement ?
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-all disabled:opacity-50"
                        onClick={handleDeleteFlight}
                        disabled={deleteFlight.isPending}
                      >
                        {deleteFlight.isPending
                          ? '⏳ Suppression...'
                          : '🗑️ Confirmer'}
                      </button>
                      <button
                        className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3D Viewer */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <FlightViewer3D
                  flightId={selectedFlightId}
                  flightTitle={
                    selectedFlight.title ||
                    `Vol du ${new Date(selectedFlight.flight_date).toLocaleDateString('fr-FR')}`
                  }
                />
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl p-12 shadow-md text-center">
              <p className="text-gray-600">
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

      {/* Modal de confirmation suppression multiple */}
      {showDeleteConfirm && selectionMode && selectedFlightIds.size > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-red-600 mb-3">
              ⚠️ Confirmer la suppression
            </h3>
            <p className="text-gray-700 mb-4">
              Vous êtes sur le point de supprimer définitivement{' '}
              <span className="font-bold text-red-600">
                {selectedFlightIds.size} vol
                {selectedFlightIds.size > 1 ? 's' : ''}
              </span>
              . Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteFlight}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
              >
                🗑️ Supprimer {selectedFlightIds.size} vol
                {selectedFlightIds.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
