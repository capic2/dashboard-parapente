import { useCallback } from 'react';
import type { Row, RowSelectionState, OnChangeFn } from '@tanstack/react-table';
import { DataList } from '@dashboard-parapente/design-system';
import { useFlightsTable, FLIGHT_SORTABLE_COLUMNS } from './useFlightsTable';
import type { Flight } from '../../types';

interface FlightsTableProps {
  flights: Flight[];
  selectedFlightId: string | null;
  selectionMode: boolean;
  onSelectFlight: (flight: Flight) => void;
  onDeleteFlight: (flight: Flight) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}

export function FlightsTable({
  flights,
  selectedFlightId,
  selectionMode,
  onSelectFlight,
  onDeleteFlight,
  rowSelection,
  onRowSelectionChange,
}: FlightsTableProps) {
  const { table } = useFlightsTable({
    data: flights,
    selectionMode,
    rowSelection,
    onRowSelectionChange,
  });

  const renderFlightCard = useCallback(
    (row: Row<Flight>) => {
      const flight = row.original;
      const isSelected = selectionMode && row.getIsSelected();
      const isActive = selectedFlightId === flight.id;

      return (
        <div
          className={`group relative bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border-2 transition-all cursor-pointer ${
            isSelected
              ? 'border-sky-600 shadow-md bg-sky-50 dark:bg-sky-900/20'
              : isActive
                ? 'border-sky-600 shadow-md'
                : 'border-gray-200 dark:border-gray-700 hover:border-sky-400'
          }`}
          onClick={() => onSelectFlight(flight)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onSelectFlight(flight)}
          aria-label={`Sélectionner vol du ${new Date(flight.flight_date).toLocaleDateString('fr-FR')}`}
        >
          {/* Bouton supprimer au survol */}
          {!selectionMode && (
            <button
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-200 hover:text-red-700 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFlight(flight);
              }}
              aria-label={`Supprimer le vol ${flight.title || 'sans titre'}`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                />
              </svg>
            </button>
          )}
          <div className="flex justify-between items-start mb-2">
            {/* Checkbox en mode sélection */}
            {selectionMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => row.toggleSelected()}
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
                {new Date(flight.departure_time).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
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
      );
    },
    [selectionMode, selectedFlightId, onSelectFlight, onDeleteFlight]
  );

  return (
    <DataList
      table={table}
      renderItem={renderFlightCard}
      sortableColumns={FLIGHT_SORTABLE_COLUMNS}
      emptyMessage="Aucun vol enregistré"
    />
  );
}
