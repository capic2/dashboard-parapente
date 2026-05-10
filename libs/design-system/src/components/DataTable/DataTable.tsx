import type { ReactNode } from 'react';
import { flexRender, type Table } from '@tanstack/react-table';
import { tv } from 'tailwind-variants';

const dataTable = tv({
  slots: {
    headerCell:
      'text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300',
    row: 'border-b border-gray-100 dark:border-gray-700 transition-colors',
  },
  variants: {
    sortable: {
      true: {
        headerCell:
          'cursor-pointer select-none hover:text-sky-600 dark:hover:text-sky-400 transition-colors',
      },
      false: {},
    },
    hoverable: {
      true: {
        row: 'hover:bg-gray-50 dark:hover:bg-gray-700',
      },
      false: {},
    },
  },
  defaultVariants: {
    hoverable: true,
  },
});

interface DataTableProps<TData> {
  table: Table<TData>;
  className?: string;
}

function getAriaSort(
  sorted: false | 'asc' | 'desc',
  canSort: boolean
): 'ascending' | 'descending' | 'none' | undefined {
  if (sorted === 'asc') {
    return 'ascending';
  }
  if (sorted === 'desc') {
    return 'descending';
  }
  if (canSort) {
    return 'none';
  }
  return undefined;
}

export function DataTable<TData>({ table, className }: DataTableProps<TData>) {
  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b-2 border-gray-200 dark:border-gray-700"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const headerContent = flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  );

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={dataTable({ sortable: canSort }).headerCell()}
                      aria-sort={getAriaSort(sorted, canSort)}
                    >
                      {!header.isPlaceholder && canSort && (
                        <button
                          type="button"
                          className="flex w-full cursor-pointer items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {headerContent}
                          {sorted && (
                            <span aria-hidden="true">
                              {sorted === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </button>
                      )}
                      {!header.isPlaceholder && !canSort && headerContent}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((tableRow) => (
              <tr
                key={tableRow.id}
                className={dataTable({ hoverable: true }).row()}
              >
                {tableRow.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="py-2 px-2">
                    {cell.column.columnDef.cell
                      ? flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )
                      : (cell.getValue() as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
