import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { DataTable } from '@dashboard-parapente/core/DataTable/DataTable';
import type { Flight } from '../../types';

const COLORS = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc949',
  '#af7aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ab',
];

interface SiteDetail {
  siteId: string;
  name: string;
  count: number;
  percentage: number;
  avgAltitude: number;
  totalHours: number;
  totalMinutes: number;
  colorIndex: number;
}

interface SiteStatsProps {
  flights: Flight[];
}

const columnHelper = createColumnHelper<SiteDetail>();

const columns = [
  columnHelper.accessor('name', {
    header: 'Site',
    cell: (info) => (
      <span className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full inline-block shrink-0"
          style={{
            backgroundColor:
              COLORS[info.row.original.colorIndex % COLORS.length],
          }}
        />
        <span className="font-medium">{info.getValue()}</span>
      </span>
    ),
  }),
  columnHelper.accessor('count', {
    header: 'Vols',
  }),
  columnHelper.accessor('percentage', {
    header: '%',
    cell: (info) => `${info.getValue()}%`,
  }),
  columnHelper.accessor('avgAltitude', {
    header: 'Alt. moy.',
    meta: { className: 'hidden sm:table-cell' },
    cell: (info) => `${info.getValue()} m`,
  }),
  columnHelper.display({
    id: 'totalTime',
    header: 'Temps total',
    meta: { className: 'hidden sm:table-cell' },
    cell: (info) => {
      const row = info.row.original;
      return `${row.totalHours}h${row.totalMinutes}m`;
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.totalHours * 60 + rowA.original.totalMinutes;
      const b = rowB.original.totalHours * 60 + rowB.original.totalMinutes;
      return a - b;
    },
    enableSorting: true,
  }),
];

export default function SiteStats({ flights }: SiteStatsProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'count', desc: true },
  ]);

  const { siteData, siteDetails } = useMemo(() => {
    if (!flights.length) return { siteData: [], siteDetails: [] };

    // Group flights by site
    const siteMap = new Map<string, { flights: Flight[]; name: string }>();

    flights.forEach((flight) => {
      const siteId = flight.site_id;

      // Skip flights without a site_id
      if (!siteId) return;

      const siteName = flight.site_name || flight.site_id || 'Site inconnu';

      if (!siteMap.has(siteId)) {
        siteMap.set(siteId, { flights: [], name: siteName });
      }
      siteMap.get(siteId)?.flights.push(flight);
    });

    // Calculate stats per site
    const details = Array.from(siteMap.entries()).map(
      ([siteId, { flights: siteFlights, name }], index) => {
        const totalFlights = siteFlights.length;
        const percentage = ((totalFlights / flights.length) * 100).toFixed(1);
        const avgAltitude =
          siteFlights.reduce((sum, f) => sum + (f.max_altitude_m || 0), 0) /
          totalFlights;
        const totalDuration = siteFlights.reduce(
          (sum, f) => sum + (f.duration_minutes || 0),
          0
        );

        return {
          siteId,
          name,
          count: totalFlights,
          percentage: parseFloat(percentage),
          avgAltitude: Math.round(avgAltitude),
          totalHours: Math.floor(totalDuration / 60),
          totalMinutes: totalDuration % 60,
          colorIndex: index,
        };
      }
    );

    // Prepare pie chart data
    const pieData = details.map((site) => ({
      name: site.name,
      value: site.count,
    }));

    return { siteData: pieData, siteDetails: details };
  }, [flights]);

  const table = useReactTable({
    data: siteDetails,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.siteId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!siteData.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md text-center">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          📍 Statistiques par Site
        </h3>
        <p className="text-red-600 dark:text-red-400 text-sm">
          Pas de données disponibles
        </p>
      </div>
    );
  }

  const rankedSiteDetails = [...siteDetails].sort((a, b) => b.count - a.count);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        📍 Statistiques par Site
      </h3>

      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
        <div className="h-56 min-w-0" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={siteData}
                cx="50%"
                cy="50%"
                outerRadius="82%"
                fill="#8884d8"
                dataKey="value"
              >
                {siteData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value} vols`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul
          aria-label="Répartition des vols par site"
          className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 md:grid-cols-1"
        >
          {rankedSiteDetails.map((site) => (
            <li
              key={site.siteId}
              className="flex min-w-0 items-start gap-2 text-sm text-gray-700 dark:text-gray-200"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-3 w-3 shrink-0 rounded-sm"
                style={{
                  backgroundColor: COLORS[site.colorIndex % COLORS.length],
                }}
              />
              <span className="min-w-0 flex-1 break-words">{site.name}</span>
              <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-gray-900 dark:text-white">
                {site.percentage}%{' '}
                <span className="font-normal text-gray-500 dark:text-gray-400">
                  ({site.count})
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Detailed Table */}
      <DataTable table={table} className="mt-4" />
    </div>
  );
}
