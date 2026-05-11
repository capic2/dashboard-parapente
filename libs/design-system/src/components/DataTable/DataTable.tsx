import type { ReactNode } from 'react';
import { flexRender, type Table } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
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
  emptyMessage?: string;
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' }) {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={
          direction === 'desc'
            ? 'm19.5 8.25-7.5 7.5-7.5-7.5'
            : 'm4.5 15.75 7.5-7.5 7.5 7.5'
        }
      />
    </svg>
  );
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

export function DataTable<TData>({
  table,
  className,
  emptyMessage,
}: DataTableProps<TData>) {
  const { t } = useTranslation();
  const rows = table.getRowModel().rows;
  const visibleColumnCount = table.getVisibleLeafColumns().length;

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
                          {sorted && <SortIcon direction={sorted} />}
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
            {rows.map((tableRow) => (
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
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="px-3 py-8 text-center text-sm font-medium text-gray-600 dark:text-gray-300"
                >
                  {emptyMessage ?? t('dataTable.noItems')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
