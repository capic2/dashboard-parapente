import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
  type OnChangeFn,
} from '@tanstack/react-table';
import type { FlightSummary } from '@dashboard-parapente/shared-types';

const columnHelper = createColumnHelper<FlightSummary>();

const columns = [
  columnHelper.accessor('flight_date', {
    sortingFn: 'alphanumeric', // YYYY-MM-DD format sorts correctly as string
  }),
  columnHelper.accessor('site_name', {
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('duration_minutes', {
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.duration_minutes ?? -Infinity;
      const b = rowB.original.duration_minutes ?? -Infinity;
      return a - b;
    },
  }),
  columnHelper.accessor('max_altitude_m', {
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.max_altitude_m ?? -Infinity;
      const b = rowB.original.max_altitude_m ?? -Infinity;
      return a - b;
    },
  }),
  columnHelper.accessor('distance_km', {
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.distance_km ?? -Infinity;
      const b = rowB.original.distance_km ?? -Infinity;
      return a - b;
    },
  }),
];

interface UseFlightsTableOptions {
  data: FlightSummary[];
  selectionMode: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
}

export function useFlightsTable({
  data,
  selectionMode,
  rowSelection,
  onRowSelectionChange,
  sorting,
  onSortingChange,
}: UseFlightsTableOptions) {
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    enableRowSelection: selectionMode,
    manualSorting: true,
    onSortingChange,
    onRowSelectionChange,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return { table };
}
