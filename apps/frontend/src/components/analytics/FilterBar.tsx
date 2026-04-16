import { useTranslation } from 'react-i18next';
import { useFiltersStore } from '../../stores/filtersStore';
import { DatePicker, Select, Button } from '@dashboard-parapente/design-system';
import type { Site } from '@dashboard-parapente/shared-types';

interface FilterBarProps {
  sites: Site[];
}

/**
 * Barre de filtres pour les analyses de vols
 *
 * Permet de filtrer par :
 * - Site de décollage
 * - Plage de dates (date de début et fin)
 */
export function FilterBar({ sites }: FilterBarProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'fr-FR';
  const { filters, setSiteId, setDateFrom, setDateTo, resetFilters } =
    useFiltersStore();

  const siteOptions = sites.map((site) => ({
    id: site.id,
    label: site.name,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('filters.title')}
          </h3>
          <Button
            onClick={resetFilters}
            tone="ghost"
            size="sm"
            className="text-sm text-sky-600 hover:text-sky-700 font-medium"
          >
            {t('filters.reset')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Site filter */}
          <Select
            label={t('common.site')}
            options={siteOptions}
            value={filters.siteId}
            onChange={setSiteId}
            placeholder={t('filters.allSites')}
          />

          {/* Date from filter */}
          <DatePicker
            label={t('filters.dateFrom')}
            value={filters.dateFrom || ''}
            onChange={(value) => setDateFrom(value || null)}
          />

          {/* Date to filter */}
          <DatePicker
            label={t('filters.dateTo')}
            value={filters.dateTo || ''}
            onChange={(value) => setDateTo(value || null)}
          />
        </div>

        {/* Active filters summary */}
        {(filters.siteId || filters.dateFrom || filters.dateTo) && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">{t('filters.activeFilters')}</span>
            {filters.siteId && (
              <span className="px-2 py-1 bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 rounded">
                {sites.find((s) => s.id === filters.siteId)?.name ||
                  t('common.site')}
              </span>
            )}
            {filters.dateFrom && (
              <span className="px-2 py-1 bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 rounded">
                {t('filters.from')}{' '}
                {new Date(filters.dateFrom).toLocaleDateString(dateLocale)}
              </span>
            )}
            {filters.dateTo && (
              <span className="px-2 py-1 bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 rounded">
                {t('filters.to')}{' '}
                {new Date(filters.dateTo).toLocaleDateString(dateLocale)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
