import type { ReactNode } from 'react';
import type { Table, Row } from '@tanstack/react-table';
import {
  Button,
  GridList,
  GridListItem,
  type Selection,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';

const sortButton = tv({
  base: 'px-3 py-2 sm:px-2 sm:py-1 text-xs rounded-md font-medium transition-colors',
  variants: {
    active: {
      true: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
      false:
        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
    },
  },
});

const paginationButton = tv({
  base: 'px-3 py-2.5 sm:py-1 text-sm rounded-md font-medium transition-colors',
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
  renderItem: (row: Row<TData>, options: { isSelected: boolean }) => ReactNode;
  sortableColumns?: SortableColumn[];
  emptyMessage?: string;
  className?: string;
  itemsClassName?: string;
  ariaLabel?: string;
  layout?: 'stack' | 'grid';
  selectionMode?: 'none' | 'single' | 'multiple';
  selectedKeys?: Selection;
  onSelectionChange?: (keys: Selection) => void;
  getTextValue?: (row: Row<TData>) => string;
}

export function DataList<TData>({
  table,
  renderItem,
  sortableColumns,
  emptyMessage,
  className,
  itemsClassName,
  ariaLabel = 'Liste',
  layout = 'stack',
  selectionMode = 'none',
  selectedKeys,
  onSelectionChange,
  getTextValue,
}: DataListProps<TData>) {
  const { t } = useTranslation();
  const rows = table.getRowModel().rows;
  const sorting = table.getState().sorting;
  const pageCount = table.getPageCount();
  const { pageIndex } = table.getState().pagination;

  return (
    <div className={className}>
      {/* Sort bar */}
      {sortableColumns && sortableColumns.length > 0 && (
        <div
          role="group"
          aria-label={t('dataList.sortOptions')}
          className="flex flex-wrap gap-1.5 mb-3"
        >
          {sortableColumns.map((col) => {
            const currentSort = sorting.find((s) => s.id === col.id);
            const isActive = !!currentSort;

            return (
              <Button
                key={col.id}
                className={sortButton({ active: isActive })}
                aria-label={
                  currentSort
                    ? t(
                        currentSort.desc
                          ? 'dataList.sortByDesc'
                          : 'dataList.sortByAsc',
                        { column: col.label }
                      )
                    : t('dataList.sortBy', { column: col.label })
                }
                aria-pressed={isActive}
                onPress={() => {
                  const column = table.getColumn(col.id);
                  if (column) {
                    column.toggleSorting();
                  }
                }}
              >
                {col.label}
                {currentSort && (
                  <span aria-hidden="true" className="ml-1">
                    {currentSort.desc ? '↓' : '↑'}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      )}

      {/* Items */}
      <GridList
        items={rows}
        aria-label={ariaLabel}
        className={itemsClassName || 'space-y-2'}
        layout={layout}
        selectionMode={selectionMode}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        renderEmptyState={() => (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center">
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              {emptyMessage ?? t('dataList.noItems')}
            </p>
          </div>
        )}
      >
        {(row) => (
          <GridListItem
            id={row.id}
            textValue={getTextValue?.(row) || row.id}
            className="outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 rounded-lg h-full"
          >
            {({ isSelected }) => renderItem(row, { isSelected })}
          </GridListItem>
        )}
      </GridList>

      {/* Pagination */}
      {pageCount > 1 && (
        <nav
          aria-label={t('dataList.pagination')}
          className="flex items-center justify-between mt-3 px-1"
        >
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('dataList.pageInfo', {
              current: pageIndex + 1,
              total: pageCount,
            })}
          </span>
          <div className="flex gap-1">
            <Button
              aria-label={t('dataList.previousPage')}
              className={paginationButton({
                disabled: !table.getCanPreviousPage(),
              })}
              onPress={() => table.previousPage()}
              isDisabled={!table.getCanPreviousPage()}
            >
              <span aria-hidden="true">←</span>
            </Button>
            <Button
              aria-label={t('dataList.nextPage')}
              className={paginationButton({
                disabled: !table.getCanNextPage(),
              })}
              onPress={() => table.nextPage()}
              isDisabled={!table.getCanNextPage()}
            >
              <span aria-hidden="true">→</span>
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
