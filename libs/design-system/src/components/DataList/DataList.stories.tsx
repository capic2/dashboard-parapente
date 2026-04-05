import preview from '../../../.storybook/preview';
import type { Row } from '@tanstack/react-table';
import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import type { Selection } from 'react-aria-components';
import { DataList } from './DataList';
import { expect, fn } from 'storybook/test';
import { StoryContext } from '@storybook/react';

interface DataListContext extends StoryContext {
  parameters: {
    dataList?: {
      pageSize?: number;
      selectionMode?: 'none' | 'single' | 'multiple';
    };
  };
}

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
  selectionMode = 'none',
  onSelectionChange,
}: {
  data: MockItem[];
  pageSize?: number;
  selectionMode?: 'none' | 'single' | 'multiple';
  onSelectionChange?: (keys: Selection) => void;
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
      onSelectionChange={(keys) => {
        setSelectedKeys(keys);
        onSelectionChange?.(keys);
      }}
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
  title: 'Components/DataList',
  component: DataList,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
});

// @ts-ignore
export const Default = meta.story({
  name: 'Default',
  args: {
    onSelectionChange: fn(),
  },
  parameters: {
    dataList: {
      pageSize: 5,
      selectionMode: 'single',
    },
  } satisfies DataListContext['parameters'],
  render: (args, context: DataListContext) => (
    <DataListWrapper
      selectionMode={context.parameters?.dataList?.selectionMode}
      pageSize={context.parameters?.dataList?.pageSize}
      data={mockData}
      onSelectionChange={args.onSelectionChange}
    />
  ),
});
Default.test(
  'It can be sort',
  async ({ canvas, userEvent, context }: DataListContext) => {
    let names = mockData
      .map((data) => data.name)
      .splice(0, context.parameters.dataList?.pageSize);
    let rowNames = canvas.getAllByRole('row').map((row) => row.ariaLabel);

    await expect(rowNames).toEqual(names);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Trier par Valeur' })
    );

    names = mockData
      .sort((d1, d2) => d2.value - d1.value)
      .map((data) => data.name)
      .splice(0, context.parameters.dataList?.pageSize);
    rowNames = canvas.getAllByRole('row').map((row) => row.ariaLabel);

    await expect(rowNames).toEqual(names);
  }
);
Default.test('It is paginated', async ({ canvas, context, userEvent }) => {
  let names = mockData
    .map((data) => data.name)
    .splice(0, context.parameters.dataList?.pageSize);
  let rowNames = canvas.getAllByRole('row').map((row) => row.ariaLabel);

  await expect(rowNames).toEqual(names);

  await userEvent.click(canvas.getByRole('button', { name: 'Page suivante' }));

  names = mockData
    .map((data) => data.name)
    .splice(
      context.parameters.dataList?.pageSize,
      context.parameters.dataList?.pageSize +
        context.parameters.dataList?.pageSize -
        1
    );
  rowNames = canvas.getAllByRole('row').map((row) => row.ariaLabel);

  await expect(rowNames).toEqual(names);
});
Default.test(
  'triggers the onselectionchange callback',
  async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('row', { name: 'Alpha' }));
    await expect(args.onSelectionChange).toHaveBeenCalled();
  }
);

export const Empty = meta.story({
  name: 'Empty',
  render: () => <DataListWrapper data={[]} />,
});
