import type { ReactNode } from 'react';
import type { Table, Row } from '@tanstack/react-table';
import {
  Button,
  ListBox,
  ListBoxItem,
  ListLayout,
  Virtualizer,
  type ListLayoutOptions,
  type Selection,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';

const dataList = tv({
  slots: {
    sortButton:
      'px-3 py-2 sm:px-2 sm:py-1 text-xs rounded-md font-medium transition-colors',
    paginationButton:
      'px-3 py-2.5 sm:py-1 text-sm rounded-md font-medium transition-colors',
  },
  variants: {
    active: {
      true: {
        sortButton:
          'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
      },
      false: {
        sortButton:
          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
      },
    },
    disabled: {
      true: {
        paginationButton: 'text-gray-300 dark:text-gray-600 cursor-not-allowed',
      },
      false: {
        paginationButton:
          'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer',
      },
    },
  },
});

function DirectionIcon({ direction }: { direction: 'asc' | 'desc' }) {
  return (
    <svg
      aria-hidden="true"
      className="ml-1 h-3.5 w-3.5 shrink-0"
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

function ChevronIcon({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={
          direction === 'previous'
            ? 'M15.75 19.5 8.25 12l7.5-7.5'
            : 'm8.25 4.5 7.5 7.5-7.5 7.5'
        }
      />
    </svg>
  );
}

export interface SortableColumn {
  id: string;
  label: string;
}

export interface DataListProps<TData> {
  table: Table<TData>;
  renderItem: (row: Row<TData>, options: { isSelected: boolean }) => ReactNode;
  sortableColumns?: SortableColumn[];
  emptyMessage?: string;
  className?: string;
  itemsClassName?: string;
  ariaLabel?: string;
  layout?: 'stack' | 'grid';
  isVirtualized?: boolean;
  virtualizedLayoutOptions?: ListLayoutOptions;
  renderDependencies?: readonly unknown[];
  selectionMode?: 'none' | 'single' | 'multiple';
  selectedKeys?: Selection;
  onSelectionChange?: (keys: Selection) => void;
  getTextValue?: (row: Row<TData>) => string;
}

function EmptyState({ label }: { label: string }) {
  return (
    <output aria-label={label}>
      <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl p-8 shadow-md text-center">
        <p className="text-gray-700 dark:text-gray-300 font-medium">{label}</p>
      </div>
    </output>
  );
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
  isVirtualized = false,
  virtualizedLayoutOptions,
  renderDependencies,
  selectionMode = 'none',
  selectedKeys,
  onSelectionChange,
  getTextValue,
}: DataListProps<TData>) {
  const { t } = useTranslation();
  const emptyLabel = emptyMessage ?? t('dataList.noItems');
  const { pageIndex, pageSize } = table.getState().pagination;
  const startIndex = pageIndex * pageSize;
  const sortedRows = table.getSortedRowModel().rows;
  const rows = isVirtualized
    ? sortedRows
    : sortedRows.slice(startIndex, startIndex + pageSize);
  const sorting = table.getState().sorting;
  const pageCount = table.getPageCount();
  const isSelectable = selectionMode !== 'none';

  const isRowSelected = (rowId: string) => {
    return selectedKeys === 'all' || selectedKeys?.has(rowId) || false;
  };

  return (
    <div className={className}>
      {/* Sort bar */}
      {sortableColumns && sortableColumns.length > 0 && (
        <fieldset className="flex flex-wrap gap-1.5 mb-3">
          <legend className="sr-only">{t('dataList.sortOptions')}</legend>
          {sortableColumns.map((col) => {
            const currentSort = sorting.find((s) => s.id === col.id);
            const isActive = !!currentSort;

            return (
              <Button
                key={col.id}
                className={dataList({ active: isActive }).sortButton()}
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
                  <DirectionIcon
                    direction={currentSort.desc ? 'desc' : 'asc'}
                  />
                )}
              </Button>
            );
          })}
        </fieldset>
      )}

      {/* Items */}
      {isVirtualized ? (
        <Virtualizer
          layout={ListLayout}
          layoutOptions={{
            gap: 8,
            estimatedRowSize: 132,
            ...virtualizedLayoutOptions,
          }}
        >
          <ListBox
            aria-label={ariaLabel}
            items={rows}
            dependencies={renderDependencies}
            layout={layout}
            selectionMode={isSelectable ? selectionMode : undefined}
            selectedKeys={isSelectable ? selectedKeys : undefined}
            onSelectionChange={isSelectable ? onSelectionChange : undefined}
            className={itemsClassName || 'h-96 overflow-y-auto'}
            renderEmptyState={() => <EmptyState label={emptyLabel} />}
          >
            {(row) => {
              const textValue = getTextValue?.(row) || row.id;
              const isSelected = isRowSelected(row.id);

              return (
                <ListBoxItem
                  id={row.id}
                  textValue={textValue}
                  className="outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 rounded-lg"
                >
                  {renderItem(row, { isSelected })}
                </ListBoxItem>
              );
            }}
          </ListBox>
        </Virtualizer>
      ) : (
        <ListBox
          aria-label={ariaLabel}
          items={rows}
          dependencies={renderDependencies}
          layout={layout}
          selectionMode={isSelectable ? selectionMode : undefined}
          selectedKeys={isSelectable ? selectedKeys : undefined}
          onSelectionChange={isSelectable ? onSelectionChange : undefined}
          className={itemsClassName || 'space-y-2'}
          renderEmptyState={() => <EmptyState label={emptyLabel} />}
        >
          {(row) => {
            const textValue = getTextValue?.(row) || row.id;
            const isSelected = isRowSelected(row.id);

            return (
              <ListBoxItem
                id={row.id}
                textValue={textValue}
                className="outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 rounded-lg h-full"
              >
                {renderItem(row, { isSelected })}
              </ListBoxItem>
            );
          }}
        </ListBox>
      )}

      {/* Pagination */}
      {!isVirtualized && pageCount > 1 && (
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
              className={dataList({
                disabled: !table.getCanPreviousPage(),
              }).paginationButton()}
              onPress={() => table.previousPage()}
              isDisabled={!table.getCanPreviousPage()}
            >
              <ChevronIcon direction="previous" />
            </Button>
            <Button
              aria-label={t('dataList.nextPage')}
              className={dataList({
                disabled: !table.getCanNextPage(),
              }).paginationButton()}
              onPress={() => table.nextPage()}
              isDisabled={!table.getCanNextPage()}
            >
              <ChevronIcon direction="next" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
