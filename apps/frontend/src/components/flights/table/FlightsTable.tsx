import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Row,
  RowSelectionState,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table';
import type { Selection } from 'react-aria-components';
import { DataList } from '@dashboard-parapente/design-system';
import { Flight, type DownloadingMedia } from './Flight';
import { useFlightsTable } from './useFlightsTable';
import type { FlightSummary } from '@dashboard-parapente/shared-types';

interface FlightsTableProps {
  flights: FlightSummary[];
  selectedFlightId: string | null;
  selectionMode: boolean;
  onSelectFlight: (flight: FlightSummary) => void;
  onDeleteFlight: (flight: FlightSummary) => void;
  onDownloadGpx: (flight: FlightSummary) => void;
  onDownloadVideo: (flight: FlightSummary) => void;
  onDownloadOverlay: (flight: FlightSummary) => void;
  downloadingMedia: DownloadingMedia | null;
  unavailableMedia: ReadonlySet<string>;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
}

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
  unavailableMedia,
  rowSelection,
  onRowSelectionChange,
  sorting,
  onSortingChange,
}: FlightsTableProps) {
  const { t } = useTranslation();
  const { table } = useFlightsTable({
    data: flights,
    selectionMode,
    rowSelection,
    onRowSelectionChange,
    sorting,
    onSortingChange,
  });
  const sortableColumns = useMemo(
    () => [
      { id: 'flight_date', label: t('flights.sortDate') },
      { id: 'site_name', label: t('flights.sortSite') },
      { id: 'duration_minutes', label: t('flights.sortDuration') },
      { id: 'max_altitude_m', label: t('flights.sortAltitude') },
      { id: 'distance_km', label: t('flights.sortDistance') },
    ],
    [t]
  );

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
    (row: Row<FlightSummary>, { isSelected }: { isSelected: boolean }) => {
      const flight = row.original;

      return (
        <Flight
          flight={flight}
          isActive={selectedFlightId === flight.id}
          isSelected={isSelected}
          selectionMode={selectionMode}
          downloadingMedia={downloadingMedia}
          unavailableMedia={unavailableMedia}
          onSelectFlight={onSelectFlight}
          onDeleteFlight={onDeleteFlight}
          onDownloadGpx={onDownloadGpx}
          onDownloadVideo={onDownloadVideo}
          onDownloadOverlay={onDownloadOverlay}
        />
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
      unavailableMedia,
    ]
  );

  return (
    <DataList
      table={table}
      renderItem={renderFlightCard}
      sortableColumns={sortableColumns}
      emptyMessage={t('flights.noFlights')}
      ariaLabel={t('flights.listAriaLabel')}
      isVirtualized
      className="flex h-full flex-col lg:min-h-[calc(100vh-22rem)]"
      itemsClassName="min-h-72 flex-1 overflow-y-auto pr-1"
      virtualizedLayoutOptions={{ estimatedRowSize: 136, gap: 8 }}
      renderDependencies={[
        selectedFlightId,
        selectionMode,
        rowSelection,
        unavailableMedia,
      ]}
      selectionMode={selectionMode ? 'multiple' : 'none'}
      selectedKeys={selectedKeys}
      onSelectionChange={handleSelectionChange}
      getTextValue={(row) =>
        row.original.title || row.original.site_name || t('common.flight_one')
      }
    />
  );
}
