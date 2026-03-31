import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useSites } from '../hooks/sites/useSites';
import {
  useUpdateSite,
  useDeleteSite,
  SiteUpdate,
} from '../hooks/sites/useSiteMutations';
import type { Site } from '@dashboard-parapente/shared-types';
import { SiteCard } from '../components/sites/SiteCard';
import { EditSiteModal } from '../components/sites/EditSiteModal';

export const Sites: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: sites = [], isLoading, error } = useSites();
  const updateSite = useUpdateSite();
  const deleteSite = useDeleteSite();

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'takeoff' | 'landing' | 'both'
  >('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'region'>(
    'name'
  );

  // Modals
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filter & sort logic
  const filteredSites = useMemo(() => {
    const filtered = sites.filter((site) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.region?.toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      const matchesType =
        typeFilter === 'all' || site.usage_type === typeFilter;

      return matchesSearch && matchesType;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'region':
          return (a.region || '').localeCompare(b.region || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [sites, searchQuery, typeFilter, sortBy]);

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
      // Edit mode
      await updateSite.mutateAsync({ siteId: editingSite.id, data });
    } else {
      // Create mode - would need a createSite mutation
      // For now, this would use the existing CreateSiteModal workflow
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
    // Navigate to flights page with site filter
    void navigate({ to: '/flights' as string });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          ❌ {t('sites.sitesLoadError')}
        </div>
      </div>
    );
  }

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'name' | 'created_at' | 'region')
            }
            className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="name">{t('sites.sortByName')}</option>
            <option value="region">{t('sites.sortByRegion')}</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        {t('common.siteFound', { count: filteredSites.length })}
      </p>

      {/* Sites Grid */}
      {filteredSites.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              flightCount={0} // TODO: could fetch from API if needed
              onEdit={handleEdit}
              onDelete={handleDelete}
              onViewFlights={handleViewFlights}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">{t('sites.noSiteFound')}</p>
          {searchQuery || typeFilter !== 'all' ? (
            <p className="text-gray-400 dark:text-gray-500">{t('sites.adjustFilters')}</p>
          ) : (
            <button
              onClick={handleCreate}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              ➕ {t('sites.createFirstSite')}
            </button>
          )}
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
