import preview from '../.storybook/preview';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import type { Row } from '@tanstack/react-table';
import type { Selection } from 'react-aria-components';
import { DataList } from './DataList';

interface MockItem {
  id: string;
  name: string;
  value: number;
  category: string;
}

const mockData: MockItem[] = [
  { id: '1', name: 'Alpha', value: 42, category: 'A' },
  { id: '2', name: 'Beta', value: 17, category: 'B' },
  { id: '3', name: 'Gamma', value: 88, category: 'A' },
  { id: '4', name: 'Delta', value: 5, category: 'C' },
  { id: '5', name: 'Epsilon', value: 63, category: 'B' },
  { id: '6', name: 'Zeta', value: 31, category: 'A' },
  { id: '7', name: 'Eta', value: 99, category: 'C' },
  { id: '8', name: 'Theta', value: 12, category: 'B' },
];

const columnHelper = createColumnHelper<MockItem>();

const columns = [
  columnHelper.accessor('name', {}),
  columnHelper.accessor('value', {}),
  columnHelper.accessor('category', {}),
];

const sortableColumns = [
  { id: 'name', label: 'Nom' },
  { id: 'value', label: 'Valeur' },
  { id: 'category', label: 'Catégorie' },
];

function DataListWrapper({
  data,
  pageSize = 5,
  selectionMode = 'none' as 'none' | 'single' | 'multiple',
}: {
  data: MockItem[];
  pageSize?: number;
  selectionMode?: 'none' | 'single' | 'multiple';
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize },
    },
  });

  return (
    <DataList
      table={table}
      sortableColumns={sortableColumns}
      ariaLabel="Liste de test"
      selectionMode={selectionMode}
      selectedKeys={selectedKeys}
      onSelectionChange={setSelectedKeys}
      getTextValue={(row: Row<MockItem>) => row.original.name}
      renderItem={(row: Row<MockItem>, { isSelected }) => (
        <div
          className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border transition-colors ${
            isSelected
              ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
              : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="font-semibold text-sm text-gray-900 dark:text-white">
            {row.original.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Valeur: {row.original.value} — Catégorie: {row.original.category}
          </div>
        </div>
      )}
    />
  );
}

const meta = preview.meta({
  title: 'Components/UI/DataList',
  component: DataList,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
});

export const Default = meta.story({
  name: 'Default',
  render: () => <DataListWrapper data={mockData} />,
});

export const WithPagination = meta.story({
  name: 'With Pagination',
  render: () => <DataListWrapper data={mockData} pageSize={3} />,
});

export const WithSelection = meta.story({
  name: 'With Selection',
  render: () => <DataListWrapper data={mockData} selectionMode="multiple" />,
});

export const Empty = meta.story({
  name: 'Empty',
  render: () => <DataListWrapper data={[]} />,
});
