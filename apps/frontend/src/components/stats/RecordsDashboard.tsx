import { useTranslation } from 'react-i18next';
import { useFlightRecords } from '../../hooks/useFlights';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';

/**
 * Dashboard des records personnels
 * 
 * Affiche les 4 records principaux :
 * - Vol le plus long (durée)
 * - Plus haute altitude
 * - Plus longue distance
 * - Vitesse maximale
 */
export default function RecordsDashboard() {
  const { t, i18n } = useTranslation();
  const { data: records, isLoading, error } = useFlightRecords();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-md animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-2 w-2/3"></div>
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h3 className="text-lg font-semibold mb-2 text-gray-900">🏆 {t('records.title')}</h3>
        <div className="text-red-600">{t('common.error') + ' : '}{error.message}</div>
      </div>
    );
  }

  const recordCards = [
    {
      icon: '⏱️',
      title: t('records.longestFlight'),
      record: records?.longest_duration,
      format: (value: number) => `${value} min`,
      color: 'sky',
    },
    {
      icon: '⛰️',
      title: t('records.highestAltitude'),
      record: records?.highest_altitude,
      format: (value: number) => `${value} m`,
      color: 'emerald',
    },
    {
      icon: '🛤️',
      title: t('records.longestDistance'),
      record: records?.longest_distance,
      format: (value: number) => `${value.toFixed(2)} km`,
      color: 'amber',
    },
    {
      icon: '⚡',
      title: t('records.maxSpeed'),
      record: records?.max_speed,
      format: (value: number) => `${value.toFixed(1)} km/h`,
      color: 'violet',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">🏆 {t('records.title')}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {recordCards.map((card) => {
          const record = card.record;
          const hasRecord = record && record.value;

          return (
            <div
              key={card.title}
              className={`bg-white rounded-xl p-4 shadow-md border-2 ${
                hasRecord
                  ? `border-${card.color}-200 hover:border-${card.color}-400`
                  : 'border-gray-200'
              } transition-colors`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{card.icon}</span>
                <h3 className="text-sm font-semibold text-gray-700">{card.title}</h3>
              </div>

              {hasRecord ? (
                <>
                  <div className={`text-3xl font-bold text-${card.color}-600 mb-2`}>
                    {card.format(record.value)}
                  </div>
                  <div className="text-xs text-gray-600">
                    <div className="font-medium">{record.flight_name}</div>
                    <div className="mt-1">
                      {format(parseISO(record.flight_date), 'dd MMMM yyyy', { locale: i18n.language === 'en' ? enUS : fr })}
                    </div>
                    {record.site_name && (
                      <div className="mt-1 text-gray-500">📍 {record.site_name}</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-gray-400 text-sm py-4">
                  {t('achievements.noData')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
