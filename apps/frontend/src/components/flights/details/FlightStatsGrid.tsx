import { useTranslation } from 'react-i18next';
import type { Flight, Site } from '../../../types';
import {
  formatAltitudeMeters,
  formatDistanceKm,
  formatSpeedKmh,
  useAppSettingsStore,
} from '../../../stores/appSettingsStore';
import { formatFlightSiteLabel } from '../siteDisplay';
import { useFlightGPX } from '../../../hooks/flights/useFlightGPX';
import type { GeoPoint } from '../../../types/flight';

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

const formatVerticalSpeed = (value: number, altitudeUnit: string) =>
  altitudeUnit === 'ft'
    ? `${Math.round(value * 196.85)} ft/min`
    : `${value.toFixed(1)} m/s`;

const getVerticalRateTimestamp = (
  coordinates: GeoPoint[],
  direction: 'climb' | 'sink'
) => {
  let bestRate = 0;
  let bestTimestamp: number | undefined;

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    if (
      previous.segment !== undefined &&
      current.segment !== undefined &&
      previous.segment !== current.segment
    ) {
      continue;
    }
    const elapsed = current.timestamp - previous.timestamp;
    if (previous.timestamp <= 0 || current.timestamp <= 0 || elapsed <= 0) {
      continue;
    }
    const rate = (current.elevation - previous.elevation) / (elapsed / 1000);
    const candidate = direction === 'climb' ? rate : -rate;
    if (Number.isFinite(candidate) && candidate > bestRate) {
      bestRate = candidate;
      bestTimestamp = current.timestamp;
    }
  }

  return bestTimestamp;
};

const getExtremeTimestamp = (
  coordinates: GeoPoint[],
  getValue: (point: GeoPoint) => number,
  direction: 'min' | 'max'
) => {
  const point = coordinates.reduce<GeoPoint | undefined>((maximum, current) => {
    if (
      current.timestamp <= 0 ||
      (maximum &&
        (direction === 'max'
          ? getValue(maximum) >= getValue(current)
          : getValue(maximum) <= getValue(current)))
    ) {
      return maximum;
    }
    return current;
  }, undefined);
  return point?.timestamp;
};

const getDistanceFromTakeoff = (takeoff: GeoPoint, point: GeoPoint) => {
  const radiusKm = 6371;
  const lat1 = (takeoff.lat * Math.PI) / 180;
  const lat2 = (point.lat * Math.PI) / 180;
  const deltaLat = ((point.lat - takeoff.lat) * Math.PI) / 180;
  const deltaLon = ((point.lon - takeoff.lon) * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return (
    radiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

const getMaxDistanceTimestamp = (coordinates: GeoPoint[]) => {
  const takeoff = coordinates[0];
  if (!takeoff) return undefined;
  return getExtremeTimestamp(
    coordinates,
    (point) => getDistanceFromTakeoff(takeoff, point),
    'max'
  );
};

const getMaxSpeedTimestamp = (coordinates: GeoPoint[]) => {
  return getExtremeTimestamp(
    coordinates.filter(
      (point) => point.speed_kmh != null && Number.isFinite(point.speed_kmh)
    ),
    (point) => point.speed_kmh ?? 0,
    'max'
  );
};

export function FlightStatsGrid({ flight, sites }: FlightStatsGridProps) {
  const { t, i18n } = useTranslation();
  const units = useAppSettingsStore((state) => state.settings.units);
  const { data: trackAnalysis, isPending: isAnalysisPending } = useFlightGPX(
    flight.id,
    {},
    Boolean(flight.gpx_file_path)
  );
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
  const metricTime = (timestamp: number | undefined) =>
    timestamp
      ? t('flights.metricAtTime', {
          time: new Date(timestamp).toLocaleTimeString(i18n.language, {
            hour: '2-digit',
            minute: '2-digit',
          }),
        })
      : null;
  const maxAltitudeTime =
    trackAnalysis?.coordinates.length &&
    flight.max_altitude_m != null &&
    Math.abs(flight.max_altitude_m - trackAnalysis.max_altitude_m) <= 1
      ? metricTime(
          getExtremeTimestamp(
            trackAnalysis.coordinates,
            (point) => point.elevation,
            'max'
          )
        )
      : null;
  const elevationGainLabel =
    flight.elevation_gain_m == null
      ? 'N/A'
      : formatAltitudeMeters(flight.elevation_gain_m, units.altitude);
  const maxSpeedLabel =
    flight.max_speed_kmh == null
      ? 'N/A'
      : formatSpeedKmh(flight.max_speed_kmh, units.speed);
  const maxSpeedTime =
    trackAnalysis?.coordinates.length &&
    flight.max_speed_kmh != null &&
    trackAnalysis.max_speed_kmh != null &&
    Math.abs(flight.max_speed_kmh - trackAnalysis.max_speed_kmh) <= 0.1
      ? metricTime(getMaxSpeedTimestamp(trackAnalysis.coordinates))
      : null;
  const trackFileName = flight.gpx_file_path?.split(/[\\/]/u).pop();
  let trackAnalysisContent = (
    <p className="col-span-full text-sm text-gray-500 dark:text-gray-400">
      {t('flights.trackAnalysisUnavailable')}
    </p>
  );

  if (isAnalysisPending) {
    trackAnalysisContent = (
      <>
        <span className="sr-only">{t('flights.trackAnalysisLoading')}</span>
        {Array.from({ length: 8 }, (_, index) => (
          <div
            // The order is stable and the placeholders have no identity of their own.
            key={index}
            className="h-[67px] animate-pulse rounded-xl border border-gray-200 bg-gray-100 motion-reduce:animate-none dark:border-gray-700 dark:bg-gray-900/50"
          />
        ))}
      </>
    );
  } else if (trackAnalysis?.coordinates.length) {
    const stats = [
      {
        label: t('flights.minAltitudeLabel'),
        value: formatAltitudeMeters(
          trackAnalysis.min_altitude_m,
          units.altitude
        ),
        time: metricTime(
          getExtremeTimestamp(
            trackAnalysis.coordinates,
            (point) => point.elevation,
            'min'
          )
        ),
      },
      {
        label: t('flights.altitudeRangeLabel'),
        value: formatAltitudeMeters(
          trackAnalysis.altitude_range_m ??
            trackAnalysis.max_altitude_m - trackAnalysis.min_altitude_m,
          units.altitude
        ),
      },
      {
        label: t('flights.maxClimbRateLabel'),
        value: flight.gpx_metrics_excluded
          ? 'N/A'
          : formatVerticalSpeed(
              trackAnalysis.max_climb_rate_ms ?? 0,
              units.altitude
            ),
        time: flight.gpx_metrics_excluded
          ? undefined
          : metricTime(
              getVerticalRateTimestamp(trackAnalysis.coordinates, 'climb')
            ),
      },
      {
        label: t('flights.maxSinkRateLabel'),
        value: flight.gpx_metrics_excluded
          ? 'N/A'
          : formatVerticalSpeed(
              trackAnalysis.max_sink_rate_ms ?? 0,
              units.altitude
            ),
        time: flight.gpx_metrics_excluded
          ? undefined
          : metricTime(
              getVerticalRateTimestamp(trackAnalysis.coordinates, 'sink')
            ),
      },
      {
        label: t('flights.averageSpeedLabel'),
        value: formatSpeedKmh(
          trackAnalysis.average_speed_kmh ?? 0,
          units.speed
        ),
      },
      {
        label: t('flights.maxDistanceFromTakeoffLabel'),
        value: formatDistanceKm(
          trackAnalysis.max_distance_from_takeoff_km ?? 0,
          units.distance
        ),
        time: metricTime(getMaxDistanceTimestamp(trackAnalysis.coordinates)),
      },
      {
        label: t('flights.takeoffAltitudeLabel'),
        value: formatAltitudeMeters(
          trackAnalysis.takeoff_altitude_m ??
            trackAnalysis.coordinates[0]?.elevation ??
            0,
          units.altitude
        ),
        time: metricTime(trackAnalysis.coordinates[0]?.timestamp),
      },
      {
        label: t('flights.landingAltitudeLabel'),
        value: formatAltitudeMeters(
          trackAnalysis.landing_altitude_m ??
            trackAnalysis.coordinates[trackAnalysis.coordinates.length - 1]
              ?.elevation ??
            0,
          units.altitude
        ),
        time: metricTime(
          trackAnalysis.coordinates[trackAnalysis.coordinates.length - 1]
            ?.timestamp
        ),
      },
    ];

    trackAnalysisContent = (
      <>
        {stats.map((stat) => (
          <div className={statClass} key={stat.label}>
            <span className={labelClass}>{stat.label}</span>
            <span className={valueClass}>{stat.value}</span>
            {'time' in stat && stat.time && (
              <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
                {stat.time}
              </span>
            )}
          </div>
        ))}
      </>
    );
  }

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
          {maxAltitudeTime ? (
            <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
              {maxAltitudeTime}
            </span>
          ) : null}
        </div>
        <div className={statClass}>
          <span className={labelClass}>{t('flights.elevationGainLabel')}</span>
          <span className={valueClass}>{elevationGainLabel}</span>
        </div>
        <div className={statClass}>
          <span className={labelClass}>{t('flights.maxSpeedLabel')}</span>
          <span className={valueClass}>{maxSpeedLabel}</span>
          {maxSpeedTime ? (
            <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
              {maxSpeedTime}
            </span>
          ) : null}
        </div>
        {flight.gpx_file_path && trackAnalysisContent}
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
