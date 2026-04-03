import type { ReactNode } from 'react';
import type { Table, Row } from '@tanstack/react-table';
import { tv } from 'tailwind-variants';

const sortButton = tv({
  base: 'px-2 py-1 text-xs rounded-md font-medium transition-colors',
  variants: {
    active: {
      true: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
      false:
        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
    },
  },
});

const paginationButton = tv({
  base: 'px-3 py-1 text-sm rounded-md font-medium transition-colors',
  variants: {
    disabled: {
      true: 'text-gray-300 dark:text-gray-600 cursor-not-allowed',
      false:
        'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer',
    },
  },
});

export interface SortableColumn {
  id: string;
  label: string;
}

interface DataListProps<TData> {
  table: Table<TData>;
  renderItem: (row: Row<TData>) => ReactNode;
  sortableColumns?: SortableColumn[];
  emptyMessage?: string;
  className?: string;
}

export function DataList<TData>({
  table,
  renderItem,
  sortableColumns,
  emptyMessage = 'Aucun élément',
  className,
}: DataListProps<TData>) {
  const rows = table.getRowModel().rows;
  const sorting = table.getState().sorting;
  const pageCount = table.getPageCount();
  const { pageIndex } = table.getState().pagination;

  return (
    <div className={className}>
      {/* Sort bar */}
      {sortableColumns && sortableColumns.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {sortableColumns.map((col) => {
            const currentSort = sorting.find((s) => s.id === col.id);
            const isActive = !!currentSort;

            return (
              <button
                key={col.id}
                className={sortButton({ active: isActive })}
                onClick={() => {
                  const column = table.getColumn(col.id);
                  if (column) {
                    column.toggleSorting(
                      currentSort ? !currentSort.desc : false
                    );
                  }
                }}
              >
                {col.label}
                {currentSort && (
                  <span className="ml-1">{currentSort.desc ? '↓' : '↑'}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Items */}
      {rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center">
          <p className="text-gray-700 dark:text-gray-300 font-medium">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id}>{renderItem(row)}</div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {pageIndex + 1} / {pageCount}
          </span>
          <div className="flex gap-1">
            <button
              className={paginationButton({
                disabled: !table.getCanPreviousPage(),
              })}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              ←
            </button>
            <button
              className={paginationButton({
                disabled: !table.getCanNextPage(),
              })}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
