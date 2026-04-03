import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
  type Row,
} from '@tanstack/react-table';
import { sitesQueryOptions } from '../hooks/sites/useSites';
import {
  useUpdateSite,
  useDeleteSite,
  SiteUpdate,
} from '../hooks/sites/useSiteMutations';
import type { Site } from '@dashboard-parapente/shared-types';
import { SiteCard } from '../components/sites/SiteCard';
import { EditSiteModal } from '../components/sites/EditSiteModal';
import { DataList } from '@dashboard-parapente/design-system';

const columnHelper = createColumnHelper<Site>();

const columns = [
  columnHelper.accessor('name', {
    sortingFn: 'alphanumeric',
  }),
  columnHelper.accessor('region', {
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.region || '';
      const b = rowB.original.region || '';
      return a.localeCompare(b);
    },
  }),
  columnHelper.accessor('elevation_m', {
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.elevation_m ?? -Infinity;
      const b = rowB.original.elevation_m ?? -Infinity;
      return a - b;
    },
  }),
];

const SITE_SORTABLE_COLUMNS = [
  { id: 'name', label: 'Nom' },
  { id: 'region', label: 'Région' },
  { id: 'elevation_m', label: 'Altitude' },
];

export const Sites: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: sites } = useSuspenseQuery(sitesQueryOptions());
  const updateSite = useUpdateSite();
  const deleteSite = useDeleteSite();

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'takeoff' | 'landing' | 'both'
  >('all');

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'name', desc: false },
  ]);

  // Modals
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filter logic (search + type filter only, sorting handled by TanStack)
  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      const matchesSearch =
        searchQuery === '' ||
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.region?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        typeFilter === 'all' || site.usage_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [sites, searchQuery, typeFilter]);

  const table = useReactTable({
    data: filteredSites,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Handlers
  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setIsEditModalOpen(true);
  };

  const handleCreate = () => {
    setEditingSite(null);
    setIsEditModalOpen(true);
  };

  const handleSave = async (data: SiteUpdate) => {
    if (editingSite) {
      await updateSite.mutateAsync({ siteId: editingSite.id, data });
    } else {
      console.log('Create site:', data);
      alert(t('sites.createViaButton'));
    }
  };

  const handleDelete = async (site: Site) => {
    if (!confirm(t('sites.deleteSiteConfirm', { name: site.name }))) {
      return;
    }

    try {
      await deleteSite.mutateAsync(site.id);
      alert(t('sites.siteDeleted', { name: site.name }));
    } catch (error: unknown) {
      const errorMessage = (error as Error)?.message || t('sites.deleteError');
      alert(errorMessage);
    }
  };

  const handleViewFlights = (_site: Site) => {
    void navigate({ to: '/flights' as string });
  };

  const renderSiteCard = (row: Row<Site>) => {
    const site = row.original;
    return (
      <SiteCard
        site={site}
        flightCount={0}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onViewFlights={handleViewFlights}
      />
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{t('sites.management')}</h1>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          ➕ {t('sites.newSite')}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sites.searchPlaceholder')}
            className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          />

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(
                e.target.value as 'all' | 'takeoff' | 'landing' | 'both'
              )
            }
            className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="all">{t('sites.allTypes')}</option>
            <option value="takeoff">{t('sites.takeoffOnly')}</option>
            <option value="landing">{t('sites.landingOnly')}</option>
            <option value="both">{t('sites.both')}</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        {t('common.siteFound', { count: filteredSites.length })}
      </p>

      {/* Sites Grid with DataList sort buttons */}
      <DataList
        table={table}
        sortableColumns={SITE_SORTABLE_COLUMNS}
        emptyMessage={t('sites.noSiteFound')}
        renderItem={renderSiteCard}
        itemsClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      />

      {/* Create button when no sites and no filters */}
      {filteredSites.length === 0 && !searchQuery && typeFilter === 'all' && (
        <div className="text-center mt-4">
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ➕ {t('sites.createFirstSite')}
          </button>
        </div>
      )}

      {/* Edit Modal */}
      <EditSiteModal
        site={editingSite}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSite(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
};
