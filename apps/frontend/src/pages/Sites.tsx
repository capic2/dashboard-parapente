import { useDeferredValue, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Input, Label, TextField } from 'react-aria-components';
import { Button, DataList, Modal } from '@dashboard-parapente/design-system';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
  type Row,
} from '@tanstack/react-table';
import { sitesQueryOptions, useCreateSite } from '../hooks/sites/useSites';
import { useUpdateSite, useDeleteSite } from '../hooks/sites/useSiteMutations';
import type { Site } from '@dashboard-parapente/shared-types';
import { SiteCard } from '../components/sites/SiteCard';
import { EditSiteModal } from '../components/sites/EditSiteModal';

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
  const deferredSearchQuery = useDeferredValue(searchQuery);
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
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();

    return sites.filter((site) => {
      const matchesSearch =
        normalizedSearch === '' ||
        site.name.toLowerCase().includes(normalizedSearch) ||
        site.code?.toLowerCase().includes(normalizedSearch) ||
        site.region?.toLowerCase().includes(normalizedSearch);

      const matchesType =
        typeFilter === 'all' || site.usage_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [sites, deferredSearchQuery, typeFilter]);

  const hasActiveFilters = searchQuery.trim() !== '' || typeFilter !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
  };

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
    } catch {
      // Keep the confirmation open so the user can retry.
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
        flightCount={site.flight_count}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onViewFlights={handleViewFlights}
      />
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold">{t('sites.management')}</h1>
        <Button
          onPress={handleOpenCreateModal}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors"
        >
          {t('sites.newSite')}
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-4 md:items-end">
          {/* Search */}
          <TextField
            value={searchQuery}
            onChange={setSearchQuery}
            className="flex flex-col gap-1"
          >
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('sites.searchLabel')}
            </Label>
            <div className="relative">
              <Input
                placeholder={t('sites.searchPlaceholder')}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </TextField>

          {/* Type Filter */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('sites.typeFilterLabel')}
            </span>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(
                  e.target.value as 'all' | 'takeoff' | 'landing' | 'both'
                )
              }
              className="rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="all">{t('sites.allTypes')}</option>
              <option value="takeoff">{t('sites.takeoffOnly')}</option>
              <option value="landing">{t('sites.landingOnly')}</option>
              <option value="both">{t('sites.both')}</option>
            </select>
          </label>

          <Button
            onPress={handleResetFilters}
            isDisabled={!hasActiveFilters}
            className="inline-flex items-center justify-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {t('filters.reset')}
          </Button>
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

      {filteredSites.length === 0 && hasActiveFilters && (
        <div className="mt-4 text-center">
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
            {t('sites.adjustFilters')}
          </p>
          <Button
            onPress={handleResetFilters}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {t('filters.reset')}
          </Button>
        </div>
      )}

      {/* Create button when no sites and no filters */}
      {filteredSites.length === 0 && !searchQuery && typeFilter === 'all' && (
        <div className="text-center mt-4">
          <Button
            onPress={handleOpenCreateModal}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors"
          >
            {t('sites.createFirstSite')}
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
        title={t('sites.deleteSiteTitle')}
        size="sm"
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('sites.deleteSiteDescription', { name: siteToDelete?.name })}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            onPress={() => setSiteToDelete(null)}
            isDisabled={deleteSite.isPending}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer disabled:opacity-50 transition-colors"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onPress={handleConfirmDelete}
            isDisabled={deleteSite.isPending}
            className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer disabled:opacity-50 transition-colors"
          >
            {deleteSite.isPending ? '...' : t('common.delete', 'Supprimer')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
