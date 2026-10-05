import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Row,
  RowSelectionState,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table';
import type { Selection } from 'react-aria-components';
import { DataList } from '@dashboard-parapente/design-system';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react';
import { Flight, formatFlightDate } from './Flight';
import { useFlightsTable } from './useFlightsTable';
import type { FlightSummary } from '@dashboard-parapente/shared-types';

interface FlightsTableProps {
  flights: FlightSummary[];
  selectedFlightId: string | null;
  selectionMode: boolean;
  onSelectFlight: (flight: FlightSummary) => void;
  onDeleteFlight: (flight: FlightSummary) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  hasMoreFlights?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  emptyMessage?: string;
}

export function FlightsTable({
  flights,
  selectedFlightId,
  selectionMode,
  onSelectFlight,
  onDeleteFlight,
  rowSelection,
  onRowSelectionChange,
  sorting,
  onSortingChange,
  hasMoreFlights = false,
  isLoadingMore = false,
  onLoadMore,
  emptyMessage,
}: FlightsTableProps) {
  const { t, i18n } = useTranslation();
  const { table } = useFlightsTable({
    data: flights,
    selectionMode,
    rowSelection,
    onRowSelectionChange,
    sorting,
    onSortingChange,
  });
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    () => new Set()
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRequestedRef = useRef(false);
  const wasLoadingMoreRef = useRef(isLoadingMore);
  const groupByDate = !selectionMode && sorting[0]?.id === 'flight_date';
  const dayGroups = useMemo(() => {
    if (!groupByDate) return [];
    const groups = new Map<string, FlightSummary[]>();
    for (const flight of flights) {
      const group = groups.get(flight.flight_date) ?? [];
      group.push(flight);
      groups.set(flight.flight_date, group);
    }
    return [...groups.entries()];
  }, [flights, groupByDate]);

  useEffect(() => {
    if (!groupByDate || !selectedFlightId) return;

    const selectedDay = dayGroups.find(([, dayFlights]) =>
      dayFlights.some((flight) => flight.id === selectedFlightId)
    )?.[0];

    if (selectedDay) {
      setExpandedDays((previous) => {
        if (previous.has(selectedDay)) return previous;
        return new Set(previous).add(selectedDay);
      });
    }
  }, [dayGroups, groupByDate, selectedFlightId]);

  useEffect(() => {
    if (isLoadingMore) {
      wasLoadingMoreRef.current = true;
    } else if (wasLoadingMoreRef.current) {
      wasLoadingMoreRef.current = false;
      loadMoreRequestedRef.current = false;
    }
  }, [isLoadingMore]);
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

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (
      !groupByDate ||
      !hasMoreFlights ||
      !sentinel ||
      !onLoadMore ||
      isLoadingMore
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !loadMoreRequestedRef.current) {
          loadMoreRequestedRef.current = true;
          onLoadMore();
        }
      },
      { root: sentinel.parentElement, rootMargin: '160px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [groupByDate, hasMoreFlights, isLoadingMore, onLoadMore]);

  const renderFlightCard = useCallback(
    (row: Row<FlightSummary>, { isSelected }: { isSelected: boolean }) => {
      const flight = row.original;

      return (
        <Flight
          flight={flight}
          isActive={selectedFlightId === flight.id}
          isSelected={isSelected}
          selectionMode={selectionMode}
          onSelectFlight={onSelectFlight}
          onDeleteFlight={onDeleteFlight}
        />
      );
    },
    [selectionMode, selectedFlightId, onSelectFlight, onDeleteFlight]
  );

  const renderSortControls = () => (
    <fieldset className="mb-3 flex flex-wrap gap-1.5">
      <legend className="sr-only">{t('dataList.sortOptions')}</legend>
      {sortableColumns.map((column) => {
        const currentSort = sorting.find((sort) => sort.id === column.id);
        return (
          <button
            key={column.id}
            type="button"
            aria-pressed={Boolean(currentSort)}
            aria-label={
              currentSort
                ? t(
                    currentSort.desc
                      ? 'dataList.sortByDesc'
                      : 'dataList.sortByAsc',
                    { column: column.label }
                  )
                : t('dataList.sortBy', { column: column.label })
            }
            className={`rounded-md px-3 py-2 text-xs font-medium transition-colors sm:px-2 sm:py-1 ${
              currentSort
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
            }`}
            onClick={() => table.getColumn(column.id)?.toggleSorting()}
          >
            {column.label}
            {currentSort && (
              <span aria-hidden="true" className="ml-1">
                {currentSort.desc ? (
                  <ArrowDown
                    aria-hidden="true"
                    className="ml-1 inline h-3.5 w-3.5"
                  />
                ) : (
                  <ArrowUp
                    aria-hidden="true"
                    className="ml-1 inline h-3.5 w-3.5"
                  />
                )}
              </span>
            )}
          </button>
        );
      })}
    </fieldset>
  );

  if (groupByDate) {
    return (
      <div className="flex flex-col">
        {renderSortControls()}
        <section
          aria-label={t('flights.listAriaLabel')}
          className="h-[calc(100vh-23rem)] min-h-72 overflow-y-auto pr-1 xl:h-[calc(100vh-19rem)]"
        >
          {dayGroups.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-gray-800">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                {emptyMessage ?? t('flights.noFlights')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {dayGroups.map(([date, dayFlights]) => {
                const isExpanded = expandedDays.has(date);
                const groupId = `flights-on-${date}`;
                const siteNames = [
                  ...new Set(
                    dayFlights
                      .map((flight) => flight.site_name || flight.site_id)
                      .filter((name): name is string => Boolean(name))
                  ),
                ];

                return (
                  <section
                    key={date}
                    className="border-b border-gray-200 pb-2 dark:border-gray-700"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={groupId}
                      aria-label={t(
                        isExpanded
                          ? 'flights.collapseDayFlights'
                          : 'flights.expandDayFlights',
                        { date: formatFlightDate(date, i18n.language) }
                      )}
                      className="flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 dark:hover:bg-gray-800"
                      onClick={() => {
                        setExpandedDays((previous) => {
                          const next = new Set(previous);
                          if (next.has(date)) next.delete(date);
                          else next.add(date);
                          return next;
                        });
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300"
                        />
                      ) : (
                        <ChevronRight
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-gray-900 dark:text-gray-100">
                          {formatFlightDate(date, i18n.language)}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-gray-600 dark:text-gray-300">
                          {t('flights.dayGroupCount', {
                            count: dayFlights.length,
                          })}
                          {siteNames.length > 0 &&
                            ` · ${siteNames.join(' · ')}`}
                        </span>
                      </span>
                    </button>
                    <div
                      id={groupId}
                      hidden={!isExpanded}
                      className="space-y-2 py-2 pl-3"
                    >
                      {dayFlights.map((flight) => (
                        <Flight
                          key={flight.id}
                          flight={flight}
                          isActive={selectedFlightId === flight.id}
                          isSelected={false}
                          selectionMode={false}
                          isListOption={false}
                          onSelectFlight={onSelectFlight}
                          onDeleteFlight={onDeleteFlight}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          {hasMoreFlights && onLoadMore && (
            <div
              ref={loadMoreRef}
              aria-live="polite"
              className="flex min-h-10 items-center justify-center py-2 text-sm text-gray-500 dark:text-gray-400"
            >
              {isLoadingMore && (
                <output className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent"
                  />
                  {t('flights.loadingMore')}
                </output>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <DataList
      table={table}
      renderItem={renderFlightCard}
      sortableColumns={sortableColumns}
      emptyMessage={emptyMessage ?? t('flights.noFlights')}
      ariaLabel={t('flights.listAriaLabel')}
      isVirtualized
      className="flex flex-col"
      itemsClassName="h-[calc(100vh-23rem)] min-h-72 overflow-y-auto pr-1 xl:h-[calc(100vh-19rem)]"
      virtualizedLayoutOptions={{ estimatedRowSize: 132, gap: 8 }}
      renderDependencies={[selectedFlightId, selectionMode, rowSelection]}
      selectionMode={selectionMode ? 'multiple' : 'none'}
      selectedKeys={selectedKeys}
      onSelectionChange={handleSelectionChange}
      onLoadMore={hasMoreFlights ? onLoadMore : undefined}
      isLoadingMore={isLoadingMore}
      loadingMoreMessage={t('flights.loadingMore')}
      getTextValue={(row) =>
        row.original.title || row.original.site_name || t('common.flight_one')
      }
    />
  );
}
