import preview from '../../../.storybook/preview';
import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { DataTable } from './DataTable';

interface MockRow {
  id: string;
  name: string;
  value: number;
  category: string;
}

const mockData: MockRow[] = [
  { id: '1', name: 'Alpha', value: 42, category: 'A' },
  { id: '2', name: 'Beta', value: 17, category: 'B' },
  { id: '3', name: 'Gamma', value: 88, category: 'A' },
  { id: '4', name: 'Delta', value: 5, category: 'C' },
  { id: '5', name: 'Epsilon', value: 63, category: 'B' },
];

const columnHelper = createColumnHelper<MockRow>();

const columns = [
  columnHelper.accessor('name', { header: 'Nom' }),
  columnHelper.accessor('value', { header: 'Valeur' }),
  columnHelper.accessor('category', { header: 'Catégorie' }),
];

function DataTableWrapper({ data }: { data: MockRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return <DataTable table={table} />;
}

const meta = preview.meta({
  title: 'Components/UI/DataTable',
  component: DataTable,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
});

export const Default = meta.story({
  name: 'Default',
  render: () => <DataTableWrapper data={mockData} />,
});

export const Empty = meta.story({
  name: 'Empty',
  render: () => <DataTableWrapper data={[]} />,
});
