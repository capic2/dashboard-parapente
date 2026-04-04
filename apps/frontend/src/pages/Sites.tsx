import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Button, Input, TextField } from 'react-aria-components';
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
import { useUpdateSite, useDeleteSite } from '../hooks/sites/useSiteMutations';
import { useCreateSite } from '../hooks/sites/useSites';
import type { Site } from '@dashboard-parapente/shared-types';
import { SiteCard } from '../components/sites/SiteCard';
import { EditSiteModal } from '../components/sites/EditSiteModal';
import { DataList, Modal } from '@dashboard-parapente/design-system';

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
  const createSite = useCreateSite();

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
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);

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

  const handleOpenCreateModal = () => {
    setEditingSite(null);
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (
    data: Parameters<typeof updateSite.mutateAsync>[0]['data']
  ) => {
    if (editingSite) {
      await updateSite.mutateAsync({ siteId: editingSite.id, data });
    }
  };

  const handleCreate = async (
    data: Parameters<typeof createSite.mutateAsync>[0]
  ) => {
    await createSite.mutateAsync(data);
  };

  const handleDelete = (site: Site) => {
    setSiteToDelete(site);
  };

  const handleConfirmDelete = async () => {
    if (!siteToDelete || deleteSite.isPending) return;
    try {
      await deleteSite.mutateAsync(siteToDelete.id);
      setSiteToDelete(null);
    } catch (error: unknown) {
      console.error('Failed to delete site:', error);
    }
  };

  const handleViewFlights = (_site: Site) => {
    void navigate({ to: '/flights' });
  };

  const renderSiteCard = (
    row: Row<Site>,
    _options: { isSelected: boolean }
  ) => {
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
        <Button
          onPress={handleOpenCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
        >
          ➕ {t('sites.newSite')}
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <TextField
            value={searchQuery}
            onChange={setSearchQuery}
            aria-label={t('sites.searchPlaceholder')}
          >
            <Input
              placeholder={t('sites.searchPlaceholder')}
              className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </TextField>

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
        ariaLabel="Liste des sites"
        layout="grid"
        itemsClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        getTextValue={(row) => row.original.name}
      />

      {/* Create button when no sites and no filters */}
      {filteredSites.length === 0 && !searchQuery && typeFilter === 'all' && (
        <div className="text-center mt-4">
          <Button
            onPress={handleOpenCreateModal}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ➕ {t('sites.createFirstSite')}
          </Button>
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
        onUpdate={handleUpdate}
        onCreate={handleCreate}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        role="alertdialog"
        isOpen={!!siteToDelete}
        onClose={() => setSiteToDelete(null)}
        title={t('sites.deleteSiteConfirm', { name: siteToDelete?.name })}
        size="sm"
      >
        <div className="flex gap-3 pt-2">
          <Button
            onPress={() => setSiteToDelete(null)}
            isDisabled={deleteSite.isPending}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer disabled:opacity-50"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onPress={handleConfirmDelete}
            isDisabled={deleteSite.isPending}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer disabled:opacity-50"
          >
            {deleteSite.isPending ? '⏳ ...' : t('common.delete', 'Supprimer')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
