import { useState, useCallback } from 'react';
import {
  useFlights,
  useUpdateFlight,
  useDeleteFlight,
} from '../hooks/useFlights';
import type { Flight } from '../types';
import FlightViewer3D from '../components/FlightViewer3D';

export default function FlightHistory() {
  const { data: flights = [], isLoading, error } = useFlights({ limit: 50 });
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedFlight = flights.find((f: Flight) => f.id === selectedFlightId);
  const updateFlight = useUpdateFlight(selectedFlightId || undefined);
  const deleteFlight = useDeleteFlight(selectedFlightId || undefined);

  const handleSelectFlight = useCallback((flight: Flight) => {
    setSelectedFlightId(flight.id);
    setNotesText(flight.notes || '');
    setEditingNotes(false);
    setShowDeleteConfirm(false);
  }, []);

  const handleSaveNotes = useCallback(async () => {
    if (!selectedFlight) return;

    try {
      await updateFlight.mutateAsync({
        title: selectedFlight.title,
        site_id: selectedFlight.site_id,
        flight_date: selectedFlight.flight_date,
        duration_minutes: selectedFlight.duration_minutes,
        max_altitude_m: selectedFlight.max_altitude_m,
        distance_km: selectedFlight.distance_km,
        elevation_gain_m: selectedFlight.elevation_gain_m,
        notes: notesText,
      });
      setEditingNotes(false);
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  }, [selectedFlight, updateFlight, notesText]);

  const handleDeleteFlight = useCallback(async () => {
    if (!selectedFlightId) return;

    try {
      await deleteFlight.mutateAsync();
      setSelectedFlightId(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete flight:', err);
    }
  }, [selectedFlightId, deleteFlight]);

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
            Impossible de charger l'historique des vols
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
      <div className="mb-4 bg-white rounded-xl p-4 shadow-md">
        <h1 className="text-xl font-bold text-gray-900">
          🪂 Historique des Vols
        </h1>
        <div className="text-sm text-gray-600 mt-1">
          {flights.length} vol{flights.length > 1 ? 's' : ''} enregistré
          {flights.length > 1 ? 's' : ''}
        </div>
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
                  selectedFlightId === flight.id
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
                  <h3 className="font-semibold text-sm text-gray-900 truncate flex-1">
                    {flight.title || 'Vol sans titre'}
                  </h3>
                  <span className="text-xs text-gray-500 ml-2 shrink-0">
                    {new Date(flight.flight_date).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
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
                  <h2 className="text-lg font-bold text-gray-900">
                    {selectedFlight.title || 'Vol sans titre'}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1.5 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-all"
                      onClick={() => setEditingNotes(!editingNotes)}
                      aria-label="Éditer les notes"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-all"
                      onClick={() => setShowDeleteConfirm(true)}
                      aria-label="Supprimer le vol"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <div>
                    <span className="text-xs text-gray-600">📅 Date</span>
                    <span className="block text-sm font-medium text-gray-900 mt-1">
                      {new Date(selectedFlight.flight_date).toLocaleDateString(
                        'fr-FR',
                        {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">📍 Site</span>
                    <span className="block text-sm font-medium text-gray-900 mt-1">
                      {selectedFlight.site_name || selectedFlight.site_id}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">⏱️ Durée</span>
                    <span className="block text-sm font-medium text-gray-900 mt-1">
                      {Math.floor(selectedFlight.duration_minutes / 60)}h{' '}
                      {selectedFlight.duration_minutes % 60}m
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">📏 Distance</span>
                    <span className="block text-sm font-medium text-gray-900 mt-1">
                      {selectedFlight.distance_km.toFixed(2)} km
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">
                      ⛰️ Altitude max
                    </span>
                    <span className="block text-sm font-medium text-gray-900 mt-1">
                      {selectedFlight.max_altitude_m} m
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">📈 Dénivelé</span>
                    <span className="block text-sm font-medium text-gray-900 mt-1">
                      {selectedFlight.elevation_gain_m} m
                    </span>
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
                  {editingNotes ? (
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

                {/* Delete Confirmation */}
                {showDeleteConfirm && (
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
    </div>
  );
}
