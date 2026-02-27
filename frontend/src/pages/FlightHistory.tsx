import { useState, useCallback } from 'react';
import { useFlights, useUpdateFlight, useDeleteFlight } from '../hooks/useFlights';
import type { Flight } from '../types';
import FlightViewer3D from '../components/FlightViewer3D';
import './FlightHistory.css';

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
      <div className="flight-history">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-content"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flight-history">
        <div className="error-boundary">
          <h2>❌ Erreur</h2>
          <p>Impossible de charger l'historique des vols</p>
          <button onClick={() => window.location.reload()}>Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flight-history">
      <div className="page-header">
        <h1>🪂 Historique des Vols</h1>
        <div className="summary">
          {flights.length} vol{flights.length > 1 ? 's' : ''} enregistré{flights.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="history-layout">
        {/* Flight List */}
        <div className="flight-list">
          {flights.length === 0 ? (
            <div className="empty-state">
              <p>Aucun vol enregistré</p>
              <p className="hint">Les vols Strava apparaîtront automatiquement ici</p>
            </div>
          ) : (
            flights.map((flight: Flight) => (
              <div
                key={flight.id}
                className={`flight-card ${selectedFlightId === flight.id ? 'selected' : ''}`}
                onClick={() => handleSelectFlight(flight)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleSelectFlight(flight)}
                aria-label={`Sélectionner vol du ${new Date(flight.flight_date).toLocaleDateString('fr-FR')}`}
              >
                <div className="flight-header">
                  <h3>{flight.title || 'Vol sans titre'}</h3>
                  <span className="flight-date">
                    {new Date(flight.flight_date).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flight-stats">
                  {flight.duration_minutes && (
                    <div className="stat">
                      <span className="icon" aria-hidden="true">⏱️</span>
                      <span>{Math.floor(flight.duration_minutes / 60)}h{flight.duration_minutes % 60}m</span>
                    </div>
                  )}
                  {flight.distance_km && (
                    <div className="stat">
                      <span className="icon" aria-hidden="true">📏</span>
                      <span>{flight.distance_km.toFixed(1)} km</span>
                    </div>
                  )}
                  {flight.max_altitude_m && (
                    <div className="stat">
                      <span className="icon" aria-hidden="true">⛰️</span>
                      <span>{flight.max_altitude_m} m</span>
                    </div>
                  )}
                </div>
                {flight.site_id && (
                  <div className="flight-site">
                    <span className="icon" aria-hidden="true">📍</span>
                    <span>{flight.site_name || flight.site_id}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Detail Panel + 3D Viewer */}
        <div className="viewer-panel">
          {selectedFlightId && selectedFlight ? (
            <>
              {/* Flight Details */}
              <div className="flight-details">
                <div className="details-header">
                  <h2>{selectedFlight.title || 'Vol sans titre'}</h2>
                  <div className="details-actions">
                    <button
                      className="btn-edit"
                      onClick={() => setEditingNotes(!editingNotes)}
                      aria-label="Éditer les notes"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => setShowDeleteConfirm(true)}
                      aria-label="Supprimer le vol"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>

                <div className="details-grid">
                  <div className="detail-item">
                    <span className="label">📅 Date</span>
                    <span className="value">
                      {new Date(selectedFlight.flight_date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">📍 Site</span>
                    <span className="value">{selectedFlight.site_name || selectedFlight.site_id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">⏱️ Durée</span>
                    <span className="value">
                      {Math.floor(selectedFlight.duration_minutes / 60)}h {selectedFlight.duration_minutes % 60}m
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">📏 Distance</span>
                    <span className="value">{selectedFlight.distance_km.toFixed(2)} km</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">⛰️ Altitude max</span>
                    <span className="value">{selectedFlight.max_altitude_m} m</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">📈 Dénivelé</span>
                    <span className="value">{selectedFlight.elevation_gain_m} m</span>
                  </div>
                </div>

                {/* Notes Editor */}
                <div className="notes-section">
                  <label htmlFor="flight-notes">📝 Notes</label>
                  {editingNotes ? (
                    <div className="notes-editor">
                      <textarea
                        id="flight-notes"
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder="Conditions, sensations, points à améliorer..."
                        rows={4}
                      />
                      <div className="notes-actions">
                        <button
                          className="btn-save"
                          onClick={handleSaveNotes}
                          disabled={updateFlight.isPending}
                        >
                          {updateFlight.isPending ? '⏳ Enregistrement...' : '✓ Enregistrer'}
                        </button>
                        <button
                          className="btn-cancel"
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
                    <p className="notes-display">
                      {selectedFlight.notes || 'Aucune note pour ce vol'}
                    </p>
                  )}
                </div>

                {/* Delete Confirmation */}
                {showDeleteConfirm && (
                  <div className="delete-confirm">
                    <p>⚠️ Supprimer ce vol définitivement ?</p>
                    <div className="confirm-actions">
                      <button
                        className="btn-confirm-delete"
                        onClick={handleDeleteFlight}
                        disabled={deleteFlight.isPending}
                      >
                        {deleteFlight.isPending ? '⏳ Suppression...' : '🗑️ Confirmer'}
                      </button>
                      <button
                        className="btn-cancel-delete"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3D Viewer */}
              <div className="viewer-container">
                <FlightViewer3D
                  flightId={selectedFlightId}
                  flightTitle={selectedFlight.title || `Vol du ${new Date(selectedFlight.flight_date).toLocaleDateString('fr-FR')}`}
                  showReplay={true}
                  showElevationChart={true}
                />
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>📍 Sélectionnez un vol pour visualiser les détails et la trajectoire 3D</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
