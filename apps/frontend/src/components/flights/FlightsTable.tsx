import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Row, RowSelectionState, OnChangeFn } from '@tanstack/react-table';
import type { Selection } from 'react-aria-components';
import { DataList, Button } from '@dashboard-parapente/design-system';
import { VIDEO_EXPORT_IN_PROGRESS_STATUSES } from '@dashboard-parapente/shared-types';
import {
  Check,
  Clock3,
  Download,
  FileText,
  MapPin,
  Mountain,
  Ruler,
  Trash2,
  Video,
  Wand2,
} from 'lucide-react';
import { useFlightsTable, FLIGHT_SORTABLE_COLUMNS } from './useFlightsTable';
import type { Flight } from '../../types';
import {
  formatAltitudeMeters,
  formatDistanceKm,
  useAppSettingsStore,
} from '../../stores/appSettingsStore';

interface FlightsTableProps {
  flights: Flight[];
  selectedFlightId: string | null;
  selectionMode: boolean;
  onSelectFlight: (flight: Flight) => void;
  onDeleteFlight: (flight: Flight) => void;
  onDownloadGpx: (flight: Flight) => void;
  onDownloadVideo: (flight: Flight) => void;
  onDownloadOverlay: (flight: Flight) => void;
  downloadingMedia: {
    flightId: string;
    type: 'gpx' | 'video' | 'overlay';
  } | null;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}

// oxlint-disable-next-line max-lines-per-function
export function FlightsTable({
  flights,
  selectedFlightId,
  selectionMode,
  onSelectFlight,
  onDeleteFlight,
  onDownloadGpx,
  onDownloadVideo,
  onDownloadOverlay,
  downloadingMedia,
  rowSelection,
  onRowSelectionChange,
}: FlightsTableProps) {
  const { t, i18n } = useTranslation();
  const units = useAppSettingsStore((state) => state.settings.units);
  const { table } = useFlightsTable({
    data: flights,
    selectionMode,
    rowSelection,
    onRowSelectionChange,
  });

  // Convert TanStack RowSelectionState to react-aria Selection
  const selectedKeys = useMemo<Selection>(
    () => new Set(Object.keys(rowSelection).filter((k) => rowSelection[k])),
    [rowSelection]
  );

  // Convert react-aria Selection back to TanStack RowSelectionState
  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      if (keys === 'all') {
        const allSelected: RowSelectionState = {};
        for (const row of table.getPrePaginationRowModel().rows) {
          allSelected[row.id] = true;
        }
        onRowSelectionChange(() => allSelected);
      } else {
        const newSelection: RowSelectionState = {};
        for (const key of keys) {
          newSelection[String(key)] = true;
        }
        onRowSelectionChange(() => newSelection);
      }
    },
    [table, onRowSelectionChange]
  );

  const renderFlightCard = useCallback(
    // oxlint-disable-next-line max-lines-per-function
    (row: Row<Flight>, { isSelected }: { isSelected: boolean }) => {
      const flight = row.original;
      const isActive = selectedFlightId === flight.id;
      const hasGpx = Boolean(flight.gpx_file_path);
      const hasVideo = Boolean(flight.video_file_path);
      const hasPersistedGoproOverlay = Boolean(flight.gopro_overlay_file_path);
      const isVideoExportRunning = Boolean(
        flight.video_export_status &&
        VIDEO_EXPORT_IN_PROGRESS_STATUSES.has(flight.video_export_status)
      );
      const isVideoExportFailed = flight.video_export_status === 'failed';
      const selectFlight = () => {
        if (!selectionMode) {
          onSelectFlight(flight);
        }
      };

      let surface = 'bg-white dark:bg-gray-800';
      let color =
        'border-gray-200 dark:border-gray-700 hover:border-sky-400 hover:shadow-md';
      let titleColor = 'text-gray-900 dark:text-white';
      let metaColor = 'text-gray-500 dark:text-gray-400';
      let statsColor = 'text-gray-600 dark:text-gray-300';

      if (isSelected) {
        surface = 'bg-sky-100 dark:bg-sky-950/70';
        color =
          'border-sky-700 dark:border-sky-300 shadow-lg ring-2 ring-sky-500/40 dark:ring-sky-300/35';
        titleColor = 'text-sky-950 dark:text-white';
        metaColor = 'text-sky-800 dark:text-sky-100';
        statsColor = 'text-sky-900 dark:text-sky-100';
      } else if (isActive) {
        surface = 'bg-sky-100 dark:bg-sky-950/70';
        color =
          'border-sky-700 dark:border-sky-300 shadow-lg ring-2 ring-sky-500/40 dark:ring-sky-300/35';
        titleColor = 'text-sky-950 dark:text-white';
        metaColor = 'text-sky-800 dark:text-sky-100';
        statsColor = 'text-sky-900 dark:text-sky-100';
      }

      return (
        <div
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="option"
          aria-selected={isActive || isSelected}
          tabIndex={0}
          data-testid={`flight-row-${flight.id}`}
          className={`group relative overflow-hidden rounded-lg p-3 shadow-sm border-2 transition-all duration-200 cursor-pointer ${surface} ${color}`}
          onClick={selectFlight}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              selectFlight();
            }
          }}
        >
          {(isActive || isSelected) && (
            <span
              aria-hidden="true"
              className="absolute inset-y-2 left-0 w-1.5 rounded-r-full bg-sky-700 dark:bg-sky-300"
            />
          )}
          {/* Bouton supprimer au survol */}
          {!selectionMode && (
            <Button
              size="icon"
              variant="danger"
              className="absolute top-2 right-2 w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-200 dark:hover:bg-red-900/50 hover:text-red-700 dark:hover:text-red-200 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFlight(flight);
              }}
              aria-label={t('flights.deleteAriaLabel', {
                title: flight.title || t('flights.untitledFlight'),
              })}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <div className="flex justify-between items-start mb-2 gap-2 pl-1.5">
            <div className="min-w-0 flex-1">
              {(isActive || isSelected) && (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-sky-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-sky-300 dark:text-sky-950">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  {t('flights.activeFlight')}
                </span>
              )}
              <h3 className={`truncate text-sm font-semibold ${titleColor}`}>
                {flight.title || t('flights.untitledFlight')}
              </h3>
              {!selectionMode &&
                (hasGpx ||
                  hasVideo ||
                  isVideoExportRunning ||
                  isVideoExportFailed ||
                  hasPersistedGoproOverlay) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hasGpx && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-800 transition-colors hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200 dark:hover:bg-green-900/50 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDownloadGpx(flight);
                        }}
                        disabled={Boolean(downloadingMedia)}
                        aria-label={t('flights.downloadGpx')}
                      >
                        <FileText className="h-3 w-3" aria-hidden="true" />
                        {t('flights.gpxBadge')}
                        <Download className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                    {hasVideo && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-800 transition-colors hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/50 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDownloadVideo(flight);
                        }}
                        disabled={Boolean(downloadingMedia)}
                        aria-label={t('flights.viewer.downloadVideo')}
                      >
                        <Video className="h-3 w-3" aria-hidden="true" />
                        {t('flights.videoBadge')}
                        <Download className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                    {isVideoExportRunning && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                        {t('flights.videoProcessingBadge')}
                      </span>
                    )}
                    {isVideoExportFailed && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                        {t('flights.videoErrorBadge')}
                      </span>
                    )}
                    {hasPersistedGoproOverlay && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 transition-colors hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-900/50 dark:focus:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDownloadOverlay(flight);
                        }}
                        disabled={Boolean(downloadingMedia)}
                        aria-label={t('flights.goproOverlayDownload')}
                      >
                        <Wand2 className="h-3 w-3" aria-hidden="true" />
                        {t('flights.goproOverlayBadge')}
                        <Download className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Date et heure */}
          <div className={`mb-2 pl-1.5 text-xs ${metaColor}`}>
            <span className="font-medium">
              {(() => {
                const [year, month, day] = flight.flight_date.split('-');
                const localDate = new Date(
                  Number(year),
                  Number(month) - 1,
                  Number(day)
                );
                return localDate.toLocaleDateString(i18n.language, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
              })()}
            </span>
            {flight.departure_time && (
              <span className="ml-2">
                {t('flights.at', {
                  time: new Date(flight.departure_time).toLocaleTimeString(
                    i18n.language,
                    {
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  ),
                })}
              </span>
            )}
          </div>

          <div className={`flex flex-wrap gap-2 pl-1.5 text-xs ${statsColor}`}>
            {flight.duration_minutes && (
              <div className="flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {Math.floor(flight.duration_minutes / 60)}h
                  {flight.duration_minutes % 60}m
                </span>
              </div>
            )}
            {flight.distance_km && (
              <div className="flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {formatDistanceKm(flight.distance_km, units.distance)}
                </span>
              </div>
            )}
            {flight.max_altitude_m && (
              <div className="flex items-center gap-1">
                <Mountain className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {formatAltitudeMeters(flight.max_altitude_m, units.altitude)}
                </span>
              </div>
            )}
          </div>
          {flight.site_id && (
            <div
              className={`mt-2 flex items-center gap-1 pl-1.5 text-xs ${metaColor}`}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {flight.site_name || flight.site_id}
              </span>
            </div>
          )}
        </div>
      );
    },
    [
      selectionMode,
      selectedFlightId,
      onSelectFlight,
      onDeleteFlight,
      onDownloadGpx,
      onDownloadVideo,
      onDownloadOverlay,
      downloadingMedia,
      t,
      i18n,
      units,
    ]
  );

  return (
    <DataList
      table={table}
      renderItem={renderFlightCard}
      sortableColumns={FLIGHT_SORTABLE_COLUMNS}
      emptyMessage={t('flights.noFlights')}
      ariaLabel={t('flights.listAriaLabel')}
      isVirtualized
      className="flex h-full flex-col lg:min-h-[calc(100vh-22rem)]"
      itemsClassName="min-h-72 flex-1 overflow-y-auto pr-1"
      virtualizedLayoutOptions={{ estimatedRowSize: 136, gap: 8 }}
      renderDependencies={[selectedFlightId, selectionMode, rowSelection]}
      selectionMode={selectionMode ? 'multiple' : 'none'}
      selectedKeys={selectedKeys}
      onSelectionChange={handleSelectionChange}
      getTextValue={(row) =>
        row.original.title || row.original.site_name || t('common.flight_one')
      }
    />
  );
}
