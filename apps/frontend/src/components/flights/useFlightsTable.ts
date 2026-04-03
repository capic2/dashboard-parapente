import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
  type OnChangeFn,
} from '@tanstack/react-table';
import type { Flight } from '../../types';

const columnHelper = createColumnHelper<Flight>();

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

export const FLIGHT_SORTABLE_COLUMNS = [
  { id: 'flight_date', label: 'Date' },
  { id: 'site_name', label: 'Site' },
  { id: 'duration_minutes', label: 'Durée' },
  { id: 'max_altitude_m', label: 'Altitude' },
  { id: 'distance_km', label: 'Distance' },
];

interface UseFlightsTableOptions {
  data: Flight[];
  selectionMode: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}

export function useFlightsTable({
  data,
  selectionMode,
  rowSelection,
  onRowSelectionChange,
}: UseFlightsTableOptions) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'flight_date', desc: true },
  ]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    enableRowSelection: selectionMode,
    onSortingChange: setSorting,
    onRowSelectionChange,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 20 },
    },
  });

  return { table };
}
