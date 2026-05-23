import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Row, RowSelectionState, OnChangeFn } from '@tanstack/react-table';
import type { Selection } from 'react-aria-components';
import { DataList } from '@dashboard-parapente/design-system';
import { Flight, type DownloadingMedia } from './Flight';
import { useFlightsTable, FLIGHT_SORTABLE_COLUMNS } from './useFlightsTable';
import type { Flight as FlightRecord } from '../../types';

interface FlightsTableProps {
  flights: FlightRecord[];
  selectedFlightId: string | null;
  selectionMode: boolean;
  onSelectFlight: (flight: FlightRecord) => void;
  onDeleteFlight: (flight: FlightRecord) => void;
  onDownloadGpx: (flight: FlightRecord) => void;
  onDownloadVideo: (flight: FlightRecord) => void;
  onDownloadOverlay: (flight: FlightRecord) => void;
  downloadingMedia: DownloadingMedia | null;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
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
  rowSelection,
  onRowSelectionChange,
}: FlightsTableProps) {
  const { t } = useTranslation();
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
    (row: Row<FlightRecord>, { isSelected }: { isSelected: boolean }) => {
      const flight = row.original;

      return (
        <Flight
          flight={flight}
          isActive={selectedFlightId === flight.id}
          isSelected={isSelected}
          selectionMode={selectionMode}
          downloadingMedia={downloadingMedia}
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
