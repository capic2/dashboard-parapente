import { useState } from 'react';
import { useFlights } from '../hooks/useFlights';
import type { Flight } from '../types';
import FlightViewer3D from '../components/FlightViewer3D';
import './FlightHistory.css';

export default function FlightHistory() {
  const { data: flights = [], isLoading, error } = useFlights({ limit: 50 });
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);

  const selectedFlight = flights.find((f: Flight) => f.id === selectedFlightId);

  if (isLoading) {
    return (
      <div className="flight-history">
        <div className="loading">Chargement de l'historique...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flight-history">
        <div className="error">Erreur lors du chargement des vols</div>
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
                onClick={() => setSelectedFlightId(flight.id)}
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
                      <span className="icon">⏱️</span>
                      <span>{Math.floor(flight.duration_minutes / 60)}h{flight.duration_minutes % 60}m</span>
                    </div>
                  )}
                  {flight.distance_km && (
                    <div className="stat">
                      <span className="icon">📏</span>
                      <span>{flight.distance_km.toFixed(1)} km</span>
                    </div>
                  )}
                  {flight.max_altitude_m && (
                    <div className="stat">
                      <span className="icon">⛰️</span>
                      <span>{flight.max_altitude_m} m</span>
                    </div>
                  )}
                </div>
                {flight.site_id && (
                  <div className="flight-site">
                    <span className="icon">📍</span>
                    <span>{flight.site_name || flight.site_id}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 3D Viewer */}
        <div className="viewer-panel">
          {selectedFlightId && selectedFlight ? (
            <FlightViewer3D
              flightId={selectedFlightId}
              flightTitle={selectedFlight.title || `Vol du ${new Date(selectedFlight.flight_date).toLocaleDateString('fr-FR')}`}
              showReplay={true}
              showElevationChart={true}
            />
          ) : (
            <div className="no-selection">
              <p>📍 Sélectionnez un vol pour visualiser la trajectoire 3D</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
