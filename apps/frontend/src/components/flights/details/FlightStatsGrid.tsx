import { useTranslation } from 'react-i18next';
import type { Flight, Site } from '../../../types';
import {
  formatAltitudeMeters,
  formatDistanceKm,
  formatSpeedKmh,
  useAppSettingsStore,
} from '../../../stores/appSettingsStore';
import { formatFlightSiteLabel } from '../siteDisplay';

interface FlightStatsGridProps {
  flight: Flight;
  sites: Site[];
}

const labelClass = 'text-xs text-gray-600 dark:text-gray-300';
const valueClass =
  'block text-sm font-medium text-gray-900 dark:text-white mt-1';

export function FlightStatsGrid({ flight, sites }: FlightStatsGridProps) {
  const { t, i18n } = useTranslation();
  const units = useAppSettingsStore((state) => state.settings.units);
  const [year, month, day] = flight.flight_date.split('-');
  const localDate = new Date(Number(year), Number(month) - 1, Number(day));
  const siteLabel = formatFlightSiteLabel({
    siteId: flight.site_id,
    siteName: flight.site_name,
    sites,
    fallback: t('flights.notSpecified'),
  });
  const durationLabel =
    flight.duration_minutes == null
      ? 'N/A'
      : `${Math.floor(flight.duration_minutes / 60)}h ${flight.duration_minutes % 60}m`;
  const distanceLabel =
    flight.distance_km == null
      ? 'N/A'
      : formatDistanceKm(flight.distance_km, units.distance);
  const maxAltitudeLabel =
    flight.max_altitude_m == null
      ? 'N/A'
      : formatAltitudeMeters(flight.max_altitude_m, units.altitude);
  const elevationGainLabel =
    flight.elevation_gain_m == null
      ? 'N/A'
      : formatAltitudeMeters(flight.elevation_gain_m, units.altitude);
  const maxSpeedLabel =
    flight.max_speed_kmh == null
      ? 'N/A'
      : formatSpeedKmh(flight.max_speed_kmh, units.speed);

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
      <div>
        <span className={labelClass}>{t('flights.dateLabel')}</span>
        <span className={valueClass}>
          {localDate.toLocaleDateString(i18n.language, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>
      <div>
        <span className={labelClass}>{t('flights.departureTime')}</span>
        <span className={valueClass}>
          {flight.departure_time
            ? new Date(flight.departure_time).toLocaleTimeString(
                i18n.language,
                { hour: '2-digit', minute: '2-digit' }
              )
            : 'N/A'}
        </span>
      </div>
      <div className="col-span-2 md:col-span-3">
        <span className={labelClass}>{t('flights.siteLabel')}</span>
        <span className={valueClass}>{siteLabel}</span>
      </div>
      <div>
        <span className={labelClass}>{t('flights.durationLabel')}</span>
        <span className={valueClass}>{durationLabel}</span>
      </div>
      <div>
        <span className={labelClass}>{t('flights.distanceLabel')}</span>
        <span className={valueClass}>{distanceLabel}</span>
      </div>
      <div>
        <span className={labelClass}>{t('flights.maxAltitudeLabel')}</span>
        <span className={valueClass}>{maxAltitudeLabel}</span>
      </div>
      <div>
        <span className={labelClass}>{t('flights.elevationGainLabel')}</span>
        <span className={valueClass}>{elevationGainLabel}</span>
      </div>
      <div>
        <span className={labelClass}>{t('flights.maxSpeedLabel')}</span>
        <span className={valueClass}>{maxSpeedLabel}</span>
      </div>
    </div>
  );
}
