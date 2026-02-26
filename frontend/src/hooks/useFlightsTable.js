import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table'
import { useFlights } from './useFlights'

/**
 * TanStack Table hook for flights list with sorting, filtering, pagination
 * @param {object} filters - Optional filters (siteId, dateFrom, dateTo)
 */
export const useFlightsTable = (filters = {}) => {
  const { data: flights = [], isLoading, error } = useFlights(filters)
  const [sorting, setSorting] = useState([
    { id: 'flight_date', desc: true }, // Sort by date descending
  ])
  const [columnFilters, setColumnFilters] = useState([])
  const [columnVisibility, setColumnVisibility] = useState({})
  const [rowSelection, setRowSelection] = useState({})

  // Define table columns
  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      {
        accessorKey: 'flight_date',
        header: 'Date',
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      },
      {
        accessorKey: 'title',
        header: 'Title',
      },
      {
        accessorFn: (row) => row.site?.name || 'Unknown',
        id: 'site',
        header: 'Site',
      },
      {
        accessorKey: 'duration_minutes',
        header: 'Duration',
        cell: (info) => `${info.getValue()} min`,
      },
      {
        accessorKey: 'max_altitude_m',
        header: 'Max Alt',
        cell: (info) => `${info.getValue()} m`,
      },
      {
        accessorKey: 'distance_km',
        header: 'Distance',
        cell: (info) => `${info.getValue()} km`,
      },
      {
        accessorKey: 'elevation_gain_m',
        header: 'Climb',
        cell: (info) => `${info.getValue()} m`,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button onClick={() => handleViewFlight(row.original.id)}>
              View
            </button>
            <button onClick={() => handleEditFlight(row.original.id)}>
              Edit
            </button>
          </div>
        ),
      },
    ],
    []
  )

  // Create table instance
  const table = useReactTable({
    data: flights,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const handleViewFlight = (flightId) => {
    // Navigate to flight detail
    console.log('View flight:', flightId)
  }

  const handleEditFlight = (flightId) => {
    // Open edit modal
    console.log('Edit flight:', flightId)
  }

  return {
    table,
    isLoading,
    error,
    getRowModel: () => table.getRowModel(),
    getPageCount: () => table.getPageCount(),
    nextPage: () => table.nextPage(),
    previousPage: () => table.previousPage(),
    canNextPage: () => table.getCanNextPage(),
    canPreviousPage: () => table.getCanPreviousPage(),
  }
}

/**
 * TanStack Table hook for weather sources comparison
 */
export const useWeatherSourcesTable = (sources = []) => {
  const [sorting, setSorting] = useState([])

  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Source',
      },
      {
        accessorKey: 'provider_type',
        header: 'Type',
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: (info) => (info.getValue() ? '✓ Active' : '✗ Inactive'),
      },
      {
        id: 'last_update',
        header: 'Last Update',
        cell: () => 'Loading...',
      },
      {
        id: 'accuracy',
        header: 'Accuracy',
        cell: () => 'Computing...',
      },
    ],
    []
  )

  const table = useReactTable({
    data: sources,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return table
}
