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

const labelClass =
  'text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400';
const valueClass =
  'mt-1 block text-base font-semibold text-gray-950 dark:text-white';
const statClass =
  'rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/50';

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
  const trackFileName = flight.gpx_file_path?.split(/[\\/]/u).pop();

  return (
    <div className="mb-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium text-gray-900 dark:text-white">
          {localDate.toLocaleDateString(i18n.language, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
        {flight.departure_time && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {new Date(flight.departure_time).toLocaleTimeString(
                i18n.language,
                { hour: '2-digit', minute: '2-digit' }
              )}
            </span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span>{siteLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <div className={statClass}>
          <span className={labelClass}>{t('flights.durationLabel')}</span>
          <span className={valueClass}>{durationLabel}</span>
        </div>
        <div className={statClass}>
          <span className={labelClass}>{t('flights.distanceLabel')}</span>
          <span className={valueClass}>{distanceLabel}</span>
        </div>
        <div className={statClass}>
          <span className={labelClass}>{t('flights.maxAltitudeLabel')}</span>
          <span className={valueClass}>{maxAltitudeLabel}</span>
        </div>
        <div className={statClass}>
          <span className={labelClass}>{t('flights.elevationGainLabel')}</span>
          <span className={valueClass}>{elevationGainLabel}</span>
        </div>
        <div className={statClass}>
          <span className={labelClass}>{t('flights.maxSpeedLabel')}</span>
          <span className={valueClass}>{maxSpeedLabel}</span>
        </div>
      </div>
      {trackFileName && (
        <div className="mt-3 min-w-0">
          <span className={labelClass}>{t('flights.trackFileLabel')}</span>
          <span
            className="mt-1 block truncate text-xs text-gray-600 dark:text-gray-300"
            title={trackFileName}
          >
            {trackFileName}
          </span>
        </div>
      )}
    </div>
  );
}
