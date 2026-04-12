import React from 'react';
import { useTranslation } from 'react-i18next';
import { Site } from '@dashboard-parapente/shared-types';
import { Button } from '@dashboard-parapente/design-system';

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {site.name}
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
          <div className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">📍 </span>
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
          <div className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">🧭 </span>
            <span className="text-gray-800 dark:text-gray-100">
              {t('sites.orientation')} {site.orientation}
            </span>
          </div>
        )}

        {/* Region */}
        {site.region && (
          <div className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">🗺️ </span>
            <span className="text-gray-800 dark:text-gray-100">
              {site.region}
            </span>
          </div>
        )}

        {/* Flight count */}
        <div className="text-sm">
          <span className="text-gray-600 dark:text-gray-300">✈️ </span>
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
          className="flex-1 px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          title={t('sites.editSite')}
        >
          ✏️ {t('common.edit')}
        </Button>
        <Button
          onClick={() => onViewFlights(site)}
          className="flex-1 px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
          title={t('sites.viewFlights')}
        >
          📋 {t('header.flights')}
        </Button>
        <Button
          onClick={() => onDelete(site)}
          className="px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          title={t('sites.deleteSite')}
        >
          🗑️
        </Button>
      </div>
    </div>
  );
};
