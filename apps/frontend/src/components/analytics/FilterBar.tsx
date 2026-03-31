import { useTranslation } from 'react-i18next';
import { useSites } from '../../hooks/sites/useSites';
import { useFiltersStore } from '../../stores/filtersStore';
import { DatePicker } from '@dashboard-parapente/design-system';

/**
 * Barre de filtres pour les analyses de vols
 *
 * Permet de filtrer par :
 * - Site de décollage
 * - Plage de dates (date de début et fin)
 */
export function FilterBar() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'fr-FR';
  const { data: sites = [], isLoading } = useSites();
  const { filters, setSiteId, setDateFrom, setDateTo, resetFilters } =
    useFiltersStore();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('filters.title')}
          </h3>
          <button
            onClick={resetFilters}
            className="text-sm text-sky-600 hover:text-sky-700 font-medium"
          >
            {t('filters.reset')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Site filter */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">
              {t('common.site')}
            </label>
            <select
              value={filters.siteId || ''}
              onChange={(e) => setSiteId(e.target.value || null)}
              disabled={isLoading}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">{t('filters.allSites')}</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

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
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{t('filters.activeFilters')}</span>
            {filters.siteId && (
              <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded">
                {sites.find((s) => s.id === filters.siteId)?.name || t('common.site')}
              </span>
            )}
            {filters.dateFrom && (
              <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded">
                {t('filters.from')}{' '}
                {t('filters.from')} {new Date(filters.dateFrom).toLocaleDateString(dateLocale)}
              </span>
            )}
            {filters.dateTo && (
              <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded">
                {t('filters.to')}{' '}
                {t('filters.to')} {new Date(filters.dateTo).toLocaleDateString(dateLocale)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
