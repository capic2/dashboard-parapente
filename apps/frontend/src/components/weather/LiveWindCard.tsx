import { useTranslation } from 'react-i18next';
import { useLiveWind } from '../../hooks/weather/useLiveWind';
import type { LiveWindStation } from '../../types';

interface LiveWindCardProps {
  siteId: string;
}

const formatWindDirection = (deg: number | null | undefined): string => {
  if (deg == null || !Number.isFinite(deg)) return '—';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return directions[index] ?? '—';
};

const formatStationWind = (
  station: LiveWindStation,
  fallback: string,
  gustLabel: string
): string => {
  if (station.wind_avg_kmh === null || station.wind_avg_kmh === undefined) {
    return fallback;
  }

  const direction = formatWindDirection(station.wind_direction_deg ?? null);
  if (station.wind_max_kmh !== null && station.wind_max_kmh !== undefined) {
    return `${station.wind_avg_kmh} km/h ${direction} (${gustLabel} ${station.wind_max_kmh})`;
  }

  return `${station.wind_avg_kmh} km/h ${direction}`;
};

const StationRow = ({
  station,
  primary = false,
}: {
  station: LiveWindStation;
  primary?: boolean;
}) => {
  const { t } = useTranslation();
  const recencyLabel = station.is_outdated
    ? t('weather.liveWindStaleBadge')
    : t('weather.liveWindLiveBadge');
  const recencyClass = station.is_outdated
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200';

  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-700 p-3 ${
        primary
          ? 'bg-sky-50/70 dark:bg-sky-950/20'
          : 'bg-gray-50/70 dark:bg-gray-900/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {station.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('weather.liveWindDistance', {
              distance: station.distance_km.toFixed(1),
            })}
          </div>
        </div>
        <span
          className={`text-[11px] px-2 py-1 rounded-full font-semibold ${recencyClass}`}
        >
          {recencyLabel}
        </span>
      </div>

      <div className="text-sm text-gray-900 dark:text-white font-medium">
        💨{' '}
        {formatStationWind(
          station,
          t('weather.windUnavailable'),
          t('weather.liveWindGust')
        )}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {station.age_minutes !== null
          ? t('weather.liveWindAgeMinutes', { count: station.age_minutes })
          : t('weather.liveWindNoRecent')}
        {station.temperature_c !== null && (
          <span>• 🌡️ {station.temperature_c}°C</span>
        )}
        {station.source_url && (
          <a
            href={station.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-sky-700 dark:text-sky-300 hover:underline"
          >
            {t('weather.liveWindOpenSource')}
          </a>
        )}
      </div>
    </div>
  );
};

export default function LiveWindCard({ siteId }: LiveWindCardProps) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useLiveWind(siteId);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-sky-600">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3.5 font-semibold">
          {t('weather.liveWindTitle')}
        </h2>
        <div className="py-5 text-center text-gray-500 dark:text-gray-400 text-sm">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-sky-600">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3.5 font-semibold">
          {t('weather.liveWindTitle')}
        </h2>
        <div className="py-5 text-center text-red-500 dark:text-red-400 text-sm">
          {t('weather.liveWindError')}
        </div>
      </div>
    );
  }

  const stations = [...(data?.stations ?? [])]
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 5);
  const primaryStation = stations[0];
  const additionalStations = stations.slice(1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-sky-600 flex-1 flex flex-col gap-3">
      <div>
        <div>
          <h2 className="text-sm text-gray-700 dark:text-gray-300 font-semibold">
            {t('weather.liveWindTitle')}
          </h2>
          {data && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('weather.liveWindSubtitle', {
                name: data.site_name,
                radius: data.radius_km,
              })}
            </p>
          )}
        </div>
      </div>

      {!primaryStation ? (
        <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('weather.liveWindEmpty')}
        </div>
      ) : (
        <>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              {t('weather.liveWindNearest')}
            </div>
            <StationRow station={primaryStation} primary />
          </div>

          {additionalStations.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                {t('weather.liveWindOthers')}
              </div>
              <div className="space-y-2">
                {additionalStations.map((station) => (
                  <StationRow key={station.id} station={station} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
