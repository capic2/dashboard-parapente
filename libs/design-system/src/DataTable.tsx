import type { ReactNode } from 'react';
import type { Table } from '@tanstack/react-table';
import { tv } from 'tailwind-variants';

const headerCell = tv({
  base: 'text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300',
  variants: {
    sortable: {
      true: 'cursor-pointer select-none hover:text-sky-600 dark:hover:text-sky-400 transition-colors',
      false: '',
    },
  },
});

const row = tv({
  base: 'border-b border-gray-100 dark:border-gray-700 transition-colors',
  variants: {
    hoverable: {
      true: 'hover:bg-gray-50 dark:hover:bg-gray-700',
      false: '',
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

                  return (
                    <th
                      key={header.id}
                      className={headerCell({ sortable: canSort })}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted && (
                        <span className="ml-1">
                          {sorted === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((tableRow) => (
              <tr key={tableRow.id} className={row({ hoverable: true })}>
                {tableRow.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="py-2 px-2">
                    {cell.column.columnDef.cell
                      ? typeof cell.column.columnDef.cell === 'function'
                        ? cell.column.columnDef.cell(cell.getContext())
                        : cell.column.columnDef.cell
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
