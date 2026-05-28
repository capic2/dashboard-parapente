import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Site } from '@dashboard-parapente/shared-types';
import { Button } from '@dashboard-parapente/design-system';
import { Compass, List, MapPin, Pencil, Plane, Trash2 } from 'lucide-react';
import { getSiteDisplayName } from '../../lib/siteDisplay';

interface SiteCardProps {
  site: Site;
  flightCount?: number;
  onEdit: (site: Site) => void;
  onDelete: (site: Site) => void;
  onViewFlights: (site: Site) => void;
}

export const SiteCard: React.FC<SiteCardProps> = ({
  site,
  flightCount = 0,
  onEdit,
  onDelete,
  onViewFlights,
}) => {
  const { t } = useTranslation();

  // Type badge styling
  const getTypeBadge = () => {
    switch (site.usage_type) {
      case 'takeoff':
        return {
          label: t('sites.takeoff'),
          color:
            'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200',
        };
      case 'landing':
        return {
          label: t('sites.landing'),
          color:
            'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
        };
      case 'both':
      default:
        return {
          label: t('sites.both'),
          color:
            'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200',
        };
    }
  };

  const typeBadge = getTypeBadge();
  const siteDisplayName = getSiteDisplayName(site);

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-sky-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {siteDisplayName}
          </h3>
          {site.code && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('sites.code')} {site.code}
            </p>
          )}
        </div>
        <span
          className={`px-2 py-1 text-xs font-semibold rounded ${typeBadge.color}`}
        >
          {typeBadge.label}
        </span>
      </div>

      {/* Info Grid */}
      <div className="space-y-2 mb-4 flex-1">
        {/* GPS Coordinates */}
        {site.latitude && site.longitude && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin
              className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            <span className="text-gray-800 dark:text-gray-100">
              {site.latitude.toFixed(4)}°N, {site.longitude.toFixed(4)}°E
            </span>
            {site.elevation_m && (
              <span className="text-gray-600 dark:text-gray-300 ml-2">
                ({site.elevation_m}m)
              </span>
            )}
          </div>
        )}

        {/* Orientation */}
        {site.orientation && (
          <div className="flex items-start gap-2 text-sm">
            <Compass
              className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            <span className="text-gray-800 dark:text-gray-100">
              {t('sites.orientation')} {site.orientation}
            </span>
          </div>
        )}

        {/* Flight count */}
        <div className="flex items-start gap-2 text-sm">
          <Plane
            className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
          <span className="text-gray-800 dark:text-gray-100">
            {flightCount} {t('common.flight', { count: flightCount })}
          </span>
        </div>

        {/* Description preview */}
        {site.description && (
          <div className="text-sm text-gray-600 dark:text-gray-300 italic mt-2">
            {site.description.length > 80
              ? site.description.substring(0, 80) + '...'
              : site.description}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t dark:border-gray-700">
        <Button
          onClick={() => onEdit(site)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-sm text-white transition-colors hover:bg-sky-700 sm:px-3 sm:py-1.5"
          title={t('sites.editSite')}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {t('common.edit')}
        </Button>
        <Button
          onClick={() => onViewFlights(site)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-gray-800 transition-colors hover:bg-gray-200 sm:px-3 sm:py-1.5 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          title={t('sites.viewFlights')}
        >
          <List className="h-4 w-4" aria-hidden="true" />
          {t('header.flights')}
        </Button>
        <Button
          onClick={() => onDelete(site)}
          className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm text-white transition-colors hover:bg-red-700 sm:px-3 sm:py-1.5"
          title={t('sites.deleteSite')}
          aria-label={t('sites.deleteSite')}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
};
