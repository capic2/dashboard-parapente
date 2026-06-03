import { useDeferredValue, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Input, Label, TextField } from 'react-aria-components';
import { Button, Modal } from '@dashboard-parapente/design-system';
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from 'lucide-react';
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
import { getSiteDisplayName } from '../lib/siteDisplay';

const columnHelper = createColumnHelper<Site>();

const columns = [
  columnHelper.accessor('name', {
    sortingFn: (rowA, rowB) =>
      getSiteDisplayName(rowA.original).localeCompare(
        getSiteDisplayName(rowB.original)
      ),
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
  { id: 'region', label: 'Localité' },
  { id: 'elevation_m', label: 'Altitude' },
];

interface SiteGroup {
  location: string;
  rows: Row<Site>[];
}

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
        getSiteDisplayName(site).toLowerCase().includes(normalizedSearch) ||
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

  const sortedSiteRows = table.getSortedRowModel().rows;
  const siteGroups = sortedSiteRows.reduce<SiteGroup[]>((groups, row) => {
    const location = row.original.region?.trim() || t('sites.locationUnknown');
    const existingGroup = groups.find((group) => group.location === location);

    if (existingGroup) {
      existingGroup.rows.push(row);
    } else {
      groups.push({ location, rows: [row] });
    }

    return groups;
  }, []);

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

  const handleViewFlights = (site: Site) => {
    void navigate({ to: '/flights', search: { siteId: site.id } });
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-white transition-colors hover:bg-sky-700 sm:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('sites.newSite')}
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-6">
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
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <Input
                placeholder={t('sites.searchPlaceholder')}
                className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-gray-900 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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

      <div>
        <fieldset className="mb-4 flex flex-wrap gap-1.5">
          <legend className="sr-only">{t('dataList.sortOptions')}</legend>
          {SITE_SORTABLE_COLUMNS.map((col) => {
            const currentSort = sorting.find((sort) => sort.id === col.id);
            const isActive = !!currentSort;

            return (
              <Button
                key={col.id}
                className={`inline-flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors sm:px-2 sm:py-1 ${
                  isActive
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
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
                onPress={() => table.getColumn(col.id)?.toggleSorting()}
              >
                {col.label}
                {currentSort &&
                  (currentSort.desc ? (
                    <ArrowDown
                      className="ml-1 h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowUp
                      className="ml-1 h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  ))}
              </Button>
            );
          })}
        </fieldset>

        {siteGroups.length > 0 ? (
          <div className="space-y-8">
            {siteGroups.map((group, index) => {
              const headingId = `site-location-${index}`;

              return (
                <section key={group.location} aria-labelledby={headingId}>
                  <div className="mb-3 flex flex-col gap-1 border-b border-gray-200 pb-2 dark:border-gray-700 sm:flex-row sm:items-end sm:justify-between">
                    <h2
                      id={headingId}
                      className="text-xl font-semibold text-gray-900 dark:text-white"
                    >
                      {group.location}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {t('sites.locationGroupCount', {
                        count: group.rows.length,
                      })}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {group.rows.map((row) => (
                      <div key={row.id}>
                        {renderSiteCard(row, { isSelected: false })}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <output aria-label={t('sites.noSiteFound')}>
            <div className="rounded-xl bg-white p-8 text-center shadow-md dark:bg-gray-800">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                {t('sites.noSiteFound')}
              </p>
            </div>
          </output>
        )}
      </div>

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
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-white transition-colors hover:bg-sky-700 sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
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
          {t('sites.deleteSiteDescription', {
            name: siteToDelete ? getSiteDisplayName(siteToDelete) : undefined,
          })}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            initialFocus
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
            {!deleteSite.isPending && (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            )}
            {deleteSite.isPending
              ? t('common.loading', 'Chargement...')
              : t('common.delete', 'Supprimer')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
