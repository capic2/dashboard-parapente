import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipTrigger } from 'react-aria-components';
import {
  Clock,
  Gauge,
  Thermometer,
  Wind,
  Zap,
  Compass,
  CloudRain,
  Cloud,
  Flame,
  CircleCheck,
} from 'lucide-react';
import { useAppSettings } from '../../hooks/settings/useAppSettings';
import { useWeather } from '../../hooks/weather/useWeather';
import type { HourlyForecastItem } from '../../types';
import CacheTimestamp from '../common/CacheTimestamp';
import ScopeBadge from '../common/ScopeBadge';
import WindArrow from './WindArrow';

interface HourlyForecastProps {
  spotId: string;
  dayIndex?: number;
}

// ============================================================================
// TYPES
// ============================================================================

type CellType =
  | 'para-index'
  | 'verdict'
  | 'temperature'
  | 'wind'
  | 'gust'
  | 'direction'
  | 'precipitation'
  | 'cloud-cover';

interface BaseTooltipProps {
  hour: string;
}

interface SourceDataTooltipProps extends BaseTooltipProps {
  sources: Record<string, Record<string, number | null>>;
  consensus: number | string | null;
  unit: string;
  fieldName: string;
  label: string;
  color: string;
}

interface ParaIndexTooltipProps extends BaseTooltipProps {
  label: string;
  paraIndex: number;
  wind: number;
  gust: number;
  precipitation: number;
  temperature: number;
}

interface VerdictTooltipProps extends BaseTooltipProps {
  label: string;
  verdict: string;
  paraIndex: number;
  wind: number;
  gust: number;
  precipitation: number;
  thresholds: UiThresholds;
}

export interface UiThresholds {
  windLowMax: number;
  windWeakMax: number;
  windOptimalMax: number;
  windHighMax: number;
  gustHighMax: number;
  slotPrecipitationMax: number;
  reasonWindVeryStrongMin: number;
  reasonGustHighMin: number;
  reasonCloudVeryCloudyMin: number;
  reasonWindModerateMin: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate source URL for a given weather source
 */
const getSourceUrl = (sourceKey: string): string | null => {
  // Note: These are approximations - exact URLs would need site coordinates
  switch (sourceKey) {
    case 'open-meteo':
      return 'https://open-meteo.com/';
    case 'weatherapi':
      return 'https://www.weatherapi.com/';
    case 'meteo-parapente':
      return 'https://meteo-parapente.com/';
    case 'meteociel':
      return 'https://www.meteociel.fr/';
    case 'meteoblue':
      return 'https://www.meteoblue.com/';
    default:
      return null;
  }
};

/**
 * Get flyability display with emoji, verdict and reason
 * Format: "🟢 BON" or "🟡 MOYEN — Vent faible" or "🔴 MAUVAIS — Vent insuffisant"
 */
export const getFlyabilityDisplay = (
  hour: HourlyForecastItem,
  thresholds: UiThresholds
): { emoji: string; text: string; color: string } => {
  const verdict = hour.verdict?.toLowerCase();
  const verdictUpper = verdict?.toUpperCase() || 'MOYEN';

  // Emoji and color based on verdict
  let emoji = '🟡';
  let color = 'text-yellow-700 dark:text-yellow-300';

  if (verdict === 'bon') {
    emoji = '🟢';
    color = 'text-green-700 dark:text-green-300';
    return { emoji, text: 'BON', color };
  } else if (verdict === 'mauvais') {
    emoji = '🔴';
    color = 'text-red-700 dark:text-red-300';
  } else if (verdict === 'limite') {
    emoji = '🟠';
    color = 'text-orange-700 dark:text-orange-300';
  }

  // Determine the reason when not BON
  const wind = hour.wind || 0;
  const gust =
    hour.wind_gust ||
    hour.sources?.['open-meteo']?.wind_gust ||
    hour.sources?.['weatherapi']?.wind_gust ||
    0;
  const precipitation = hour.precipitation || 0;
  const cloudCover =
    hour.sources?.['open-meteo']?.cloud_cover ||
    hour.sources?.['weatherapi']?.cloud_cover ||
    0;

  let reason = '';

  // Priority order for reason
  if (precipitation > thresholds.slotPrecipitationMax) {
    reason = 'Pluie';
  } else if (wind > thresholds.reasonWindVeryStrongMin) {
    reason = 'Vent fort';
  } else if (gust > thresholds.reasonGustHighMin) {
    reason = 'Rafales importantes';
  } else if (wind < thresholds.windLowMax) {
    reason = 'Vent insuffisant';
  } else if (wind < thresholds.windWeakMax) {
    reason = 'Vent faible';
  } else if (wind < thresholds.windOptimalMax) {
    reason = 'Vent acceptable';
  } else if (cloudCover > thresholds.reasonCloudVeryCloudyMin) {
    reason = 'Très nuageux';
  } else if (wind > thresholds.reasonWindModerateMin) {
    reason = 'Vent modéré';
  } else {
    // Generic reason based on para-index
    reason = 'Conditions moyennes';
  }

  return {
    emoji,
    text: `${verdictUpper} — ${reason}`,
    color,
  };
};

const getVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'bon')
    return 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30';
  if (v === 'moyen')
    return 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30';
  if (v === 'limite')
    return 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30';
  return 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30';
};

const formatWindDirectionFromDegrees = (deg: number | null): string => {
  if (deg === null) return '—';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((deg % 360) / 45) % 8;
  return directions[index];
};

const formatWindDirectionWithDegrees = (deg: number | null): string => {
  if (deg === null) return '—';
  const cardinal = formatWindDirectionFromDegrees(deg);
  return `${cardinal} (${Math.round(deg)}°)`;
};

const SOURCE_NAMES: Record<string, string> = {
  'open-meteo': 'Open-Meteo',
  weatherapi: 'WeatherAPI',
  'meteo-parapente': 'Météo-parapente',
  meteociel: 'Meteociel',
  meteoblue: 'Meteoblue',
};

const SOURCE_ORDER = [
  'open-meteo',
  'weatherapi',
  'meteo-parapente',
  'meteociel',
  'meteoblue',
];

export const DEFAULT_UI_THRESHOLDS: UiThresholds = {
  windLowMax: 5,
  windWeakMax: 8,
  windOptimalMax: 15,
  windHighMax: 20,
  gustHighMax: 25,
  slotPrecipitationMax: 0.5,
  reasonWindVeryStrongMin: 35,
  reasonGustHighMin: 45,
  reasonCloudVeryCloudyMin: 80,
  reasonWindModerateMin: 25,
};

const parseSettingNumber = (
  value: string | undefined,
  fallback: number
): number => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

// ============================================================================
// TOOLTIP COMPONENTS
// ============================================================================

const ParaIndexTooltip = ({
  hour,
  label,
  paraIndex,
  wind,
  gust,
  precipitation,
  temperature,
}: ParaIndexTooltipProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-sky-500 rounded-lg shadow-xl p-4 text-sm max-w-[320px]">
      <div className="font-bold mb-3 text-sky-700 dark:text-sky-400 flex items-center justify-between gap-2 pr-8">
        <span>
          📊 {label} - {hour}
        </span>
        <ScopeBadge scope="backendFrontend" />
      </div>
      <div className="space-y-2 text-gray-700 dark:text-gray-300">
        <div className="text-lg font-bold text-sky-600 dark:text-sky-400">
          {paraIndex}/100
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
            Métriques utilisées :
          </div>
          <div className="space-y-1 text-xs">
            <div>
              • Vent moyen : <strong>{wind.toFixed(1)} km/h</strong>
            </div>
            <div>
              • Rafales max : <strong>{gust.toFixed(1)} km/h</strong>
            </div>
            <div>
              • Précipitations : <strong>{precipitation.toFixed(1)} mm</strong>
            </div>
            <div>
              • Température : <strong>{temperature.toFixed(1)}°C</strong>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Score calculé selon les conditions optimales de vol
        </div>
      </div>
    </div>
  );
};

const VerdictTooltip = ({
  hour,
  verdict,
  label,
  paraIndex,
  wind,
  gust,
  precipitation,
  thresholds,
}: VerdictTooltipProps) => {
  const criteria = [
    {
      label: `Vent dans plage optimale (${thresholds.windWeakMax}-${thresholds.windOptimalMax} km/h)`,
      met: wind >= thresholds.windWeakMax && wind <= thresholds.windOptimalMax,
    },
    {
      label: `Vent pas trop faible (> ${thresholds.windLowMax} km/h)`,
      met: wind > thresholds.windLowMax,
    },
    {
      label: `Vent pas trop fort (< ${thresholds.windHighMax} km/h)`,
      met: wind < thresholds.windHighMax,
    },
    {
      label: `Rafales acceptables (< ${thresholds.gustHighMax} km/h)`,
      met: gust < thresholds.gustHighMax,
    },
    {
      label: 'Pas de précipitations',
      met: precipitation < thresholds.slotPrecipitationMax,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-emerald-500 rounded-lg shadow-xl p-4 text-sm max-w-[320px]">
      <div className="font-bold mb-3 text-emerald-700 dark:text-emerald-400 flex items-center justify-between gap-2 pr-8">
        <span>✓ Verdict - {hour}</span>
        <ScopeBadge scope="backendFrontend" />
      </div>
      <div className="space-y-2 text-gray-700 dark:text-gray-300">
        <div className="text-lg font-bold capitalize text-emerald-600 dark:text-emerald-400">
          {verdict}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {label}: {paraIndex}/100
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
            Critères évalués :
          </div>
          <div className="space-y-1 text-xs">
            {criteria.map((criterion, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className={
                    criterion.met
                      ? 'text-green-500 dark:text-green-400'
                      : 'text-red-500 dark:text-red-400'
                  }
                >
                  {criterion.met ? '✓' : '✗'}
                </span>
                <span
                  className={
                    criterion.met
                      ? 'text-gray-700 dark:text-gray-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }
                >
                  {criterion.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between gap-2">
          <span>Raisons textuelles volabilité</span>
          <ScopeBadge scope="frontendOnly" />
        </div>
      </div>
    </div>
  );
};

const SourceDataTooltip = ({
  hour,
  sources,
  consensus,
  unit,
  fieldName,
  label,
  color,
}: SourceDataTooltipProps) => {
  return (
    <div
      className="bg-white dark:bg-gray-800 border-2 rounded-lg shadow-xl p-4 text-sm max-w-[320px]"
      style={{ borderColor: color }}
    >
      <div className="font-bold mb-3 text-gray-800 dark:text-gray-100 flex items-center gap-2">
        {label} - {hour}
      </div>
      <div className="space-y-2">
        {SOURCE_ORDER.map((sourceKey) => {
          const sourceData = sources[sourceKey];
          const sourceName = SOURCE_NAMES[sourceKey] || sourceKey;

          if (!sourceData) {
            return (
              <div
                key={sourceKey}
                className="text-xs text-gray-400 dark:text-gray-400"
              >
                <span className="font-semibold">{sourceName}:</span> (non
                disponible)
              </div>
            );
          }

          const value = sourceData[fieldName];

          const sourceUrl = getSourceUrl(sourceKey);

          // Special handling for wind (show speed + gust)
          if (
            fieldName === 'wind_speed' &&
            value !== null &&
            value !== undefined
          ) {
            const gust = sourceData['wind_gust'];
            const displayValue = `${value.toFixed(1)} km/h`;
            const gustValue =
              gust !== null && gust !== undefined
                ? ` (rafales: ${gust.toFixed(1)} km/h)`
                : '';
            return (
              <div
                key={sourceKey}
                className="text-xs text-gray-700 dark:text-gray-300 flex items-center justify-between gap-2"
              >
                <span>
                  <span className="font-semibold">{sourceName}:</span>{' '}
                  {displayValue}
                  {gustValue}
                </span>
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs flex-shrink-0"
                    title={`Ouvrir ${sourceName}`}
                  >
                    ↗
                  </a>
                )}
              </div>
            );
          }

          // Special handling for wind direction (show cardinal + degrees)
          if (
            fieldName === 'wind_direction' &&
            value !== null &&
            value !== undefined
          ) {
            const displayValue = formatWindDirectionWithDegrees(value);
            return (
              <div
                key={sourceKey}
                className="text-xs text-gray-700 dark:text-gray-300 flex items-center justify-between gap-2"
              >
                <span>
                  <span className="font-semibold">{sourceName}:</span>{' '}
                  {displayValue}
                </span>
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs flex-shrink-0"
                    title={`Ouvrir ${sourceName}`}
                  >
                    ↗
                  </a>
                )}
              </div>
            );
          }

          // General case
          if (value === null || value === undefined) {
            return (
              <div
                key={sourceKey}
                className="text-xs text-gray-400 dark:text-gray-400"
              >
                <span className="font-semibold">{sourceName}:</span> (non
                dispo.)
              </div>
            );
          }

          const displayValue =
            typeof value === 'number' ? value.toFixed(1) : value;

          return (
            <div
              key={sourceKey}
              className="text-xs text-gray-700 dark:text-gray-300 flex items-center justify-between gap-2"
            >
              <span>
                <span className="font-semibold">{sourceName}:</span>{' '}
                {displayValue} {unit}
              </span>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs"
                  title={`Ouvrir ${sourceName}`}
                >
                  ↗
                </a>
              )}
            </div>
          );
        })}

        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
          <div className="text-xs font-bold text-gray-800 dark:text-gray-100">
            Consensus :{' '}
            {consensus !== null && consensus !== undefined
              ? typeof consensus === 'number'
                ? consensus.toFixed(1)
                : consensus
              : '—'}{' '}
            {consensus !== null && consensus !== undefined ? unit : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function HourlyForecast({
  spotId,
  dayIndex = 0,
}: HourlyForecastProps) {
  const { t } = useTranslation();
  const { data: weather, isLoading, error } = useWeather(spotId, dayIndex);
  const { data: appSettings } = useAppSettings();
  const uiThresholds = useMemo<UiThresholds>(
    () => ({
      windLowMax: parseSettingNumber(
        appSettings?.para_wind_low_max,
        DEFAULT_UI_THRESHOLDS.windLowMax
      ),
      windWeakMax: parseSettingNumber(
        appSettings?.para_wind_weak_max,
        DEFAULT_UI_THRESHOLDS.windWeakMax
      ),
      windOptimalMax: parseSettingNumber(
        appSettings?.para_wind_optimal_max,
        DEFAULT_UI_THRESHOLDS.windOptimalMax
      ),
      windHighMax: parseSettingNumber(
        appSettings?.para_wind_high_max,
        DEFAULT_UI_THRESHOLDS.windHighMax
      ),
      gustHighMax: parseSettingNumber(
        appSettings?.para_gust_high_max,
        DEFAULT_UI_THRESHOLDS.gustHighMax
      ),
      slotPrecipitationMax: parseSettingNumber(
        appSettings?.para_slot_precipitation_max,
        DEFAULT_UI_THRESHOLDS.slotPrecipitationMax
      ),
      reasonWindVeryStrongMin: parseSettingNumber(
        appSettings?.ui_reason_wind_very_strong_min,
        DEFAULT_UI_THRESHOLDS.reasonWindVeryStrongMin
      ),
      reasonGustHighMin: parseSettingNumber(
        appSettings?.ui_reason_gust_high_min,
        DEFAULT_UI_THRESHOLDS.reasonGustHighMin
      ),
      reasonCloudVeryCloudyMin: parseSettingNumber(
        appSettings?.ui_reason_cloud_very_cloudy_min,
        DEFAULT_UI_THRESHOLDS.reasonCloudVeryCloudyMin
      ),
      reasonWindModerateMin: parseSettingNumber(
        appSettings?.ui_reason_wind_moderate_min,
        DEFAULT_UI_THRESHOLDS.reasonWindModerateMin
      ),
    }),
    [appSettings]
  );

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-semibold">
          Prévisions Horaires
        </h2>
        <div className="py-5 text-center text-gray-500 dark:text-gray-400 text-sm">
          Chargement...
        </div>
      </div>
    );
  }

  if (error || !weather || !weather.hourly_forecast) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-semibold">
          Prévisions Horaires
        </h2>
        <div className="py-5 text-center text-red-500 dark:text-red-400 text-sm">
          Données non disponibles
        </div>
      </div>
    );
  }

  const flyingHours = weather.hourly_forecast;

  const renderTooltipContent = (type: CellType, data: HourlyForecastItem) => {
    switch (type) {
      case 'para-index':
        return (
          <ParaIndexTooltip
            hour={data.hour}
            label={t('weather.paraIndex')}
            paraIndex={data.para_index}
            wind={data.wind_speed || 0}
            gust={
              data.sources?.['open-meteo']?.wind_gust ||
              data.sources?.['weatherapi']?.wind_gust ||
              0
            }
            precipitation={data.precipitation || 0}
            temperature={data.temperature || 0}
          />
        );

      case 'verdict':
        return (
          <VerdictTooltip
            hour={data.hour}
            label={t('weather.paraIndex')}
            verdict={data.verdict}
            paraIndex={data.para_index}
            wind={data.wind_speed || 0}
            gust={
              data.sources?.['open-meteo']?.wind_gust ||
              data.sources?.['weatherapi']?.wind_gust ||
              0
            }
            precipitation={data.precipitation || 0}
            thresholds={uiThresholds}
          />
        );

      case 'temperature':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            consensus={data.temperature}
            unit="°C"
            fieldName="temperature"
            label="🌡️ Température"
            color="#dc2626"
          />
        );

      case 'wind':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            consensus={data.wind_speed}
            unit="km/h"
            fieldName="wind_speed"
            label="💨 Vent"
            color="#2563eb"
          />
        );

      case 'gust':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            consensus={data.wind_gust ?? null}
            unit="km/h"
            fieldName="wind_gust"
            label="💨 Rafales"
            color="#dc2626"
          />
        );

      case 'direction':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            consensus={formatWindDirectionWithDegrees(
              data.sources?.['open-meteo']?.wind_direction ||
                data.sources?.['weatherapi']?.wind_direction ||
                null
            )}
            unit=""
            fieldName="wind_direction"
            label="🧭 Direction"
            color="#7c3aed"
          />
        );

      case 'precipitation':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            consensus={data.precipitation}
            unit="mm"
            fieldName="precipitation"
            label="🌧️ Précipitations"
            color="#0891b2"
          />
        );

      case 'cloud-cover':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            consensus={
              data.sources?.['open-meteo']?.cloud_cover ||
              data.sources?.['weatherapi']?.cloud_cover ||
              null
            }
            unit="%"
            fieldName="cloud_cover"
            label="☁️ Couverture nuageuse"
            color="#64748b"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
          Prévisions Horaires
        </h2>
        <div className="flex items-center gap-2">
          <ScopeBadge scope="backendFrontend" />
          <ScopeBadge scope="frontendOnly" />
          <CacheTimestamp cachedAt={weather.cached_at} />
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200 dark:border-gray-600">
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Clock size={14} /> Heure
                </span>
              </th>
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Gauge size={14} /> {t('weather.paraIndex')}
                </span>
              </th>
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Wind size={14} /> Vent (km/h)
                </span>
              </th>
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Zap size={14} /> Rafales (km/h)
                </span>
              </th>
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Compass size={14} /> Direction
                </span>
              </th>
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Thermometer size={14} /> Temp (°C)
                </span>
              </th>
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <CloudRain size={14} /> Précip. (mm)
                </span>
              </th>
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Cloud size={14} /> Nuages (%)
                </span>
              </th>
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Zap size={14} /> CAPE (J/kg)
                </span>
              </th>
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Flame size={14} /> Thermiques
                </span>
              </th>
              <th className="text-center py-2 px-2 font-semibold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <CircleCheck size={14} /> Volabilité
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="text-gray-800 dark:text-gray-100">
            {flyingHours.length > 0 ? (
              flyingHours.map((hour, index) => {
                // Prefer top-level cloud_cover, fallback to sources for compatibility
                const cloudCover =
                  hour.cloud_cover ??
                  hour.sources?.['open-meteo']?.cloud_cover ??
                  hour.sources?.['weatherapi']?.cloud_cover ??
                  null;

                // Prefer top-level wind_gust, fallback to sources for compatibility
                const gustValue =
                  hour.wind_gust ??
                  hour.sources?.['open-meteo']?.wind_gust ??
                  hour.sources?.['weatherapi']?.wind_gust ??
                  null;

                return (
                  <tr
                    key={index}
                    className={`border-b border-gray-100 dark:border-gray-700 ${getVerdictClass(hour.verdict)}`}
                  >
                    <td className="py-2.5 px-2 font-medium text-center">
                      {hour.hour}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <button
                          type="button"
                          aria-label={`${t('weather.paraIndex')} ${hour.hour}`}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
                        >
                          <strong className="text-sky-600 dark:text-sky-400">
                            {hour.para_index}/100
                          </strong>
                        </button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('para-index', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <button
                          type="button"
                          aria-label={`Vent ${hour.hour}`}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          {hour.wind}
                        </button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('wind', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <button
                          type="button"
                          aria-label={`Rafales ${hour.hour}`}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          {gustValue !== null && gustValue !== undefined
                            ? gustValue.toFixed(1)
                            : '—'}
                        </button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('gust', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <button
                          type="button"
                          aria-label={`Direction ${hour.hour}`}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors flex justify-center"
                        >
                          {hour.wind_direction_deg != null ? (
                            <WindArrow
                              degrees={hour.wind_direction_deg}
                              className="text-violet-600 dark:text-violet-400"
                            />
                          ) : (
                            '—'
                          )}
                        </button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('direction', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <button
                          type="button"
                          aria-label={`Temperature ${hour.hour}`}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          {hour.temp}
                        </button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('temperature', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <button
                          type="button"
                          aria-label={`Precipitations ${hour.hour}`}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                        >
                          {hour.precipitation !== null &&
                          hour.precipitation !== undefined
                            ? hour.precipitation.toFixed(1)
                            : '—'}
                        </button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('precipitation', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <button
                          type="button"
                          aria-label={`Nuages ${hour.hour}`}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors"
                        >
                          {cloudCover !== null && cloudCover !== undefined
                            ? Math.round(cloudCover)
                            : '—'}
                        </button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('cloud-cover', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {hour.cape !== null && hour.cape !== undefined
                        ? Math.round(hour.cape)
                        : '—'}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {hour.thermal_strength || 'faible'}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {(() => {
                        const display = getFlyabilityDisplay(
                          hour,
                          uiThresholds
                        );
                        return (
                          <TooltipTrigger delay={150} closeDelay={100}>
                            <button
                              type="button"
                              aria-label={`Verdict ${hour.hour}`}
                              className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                            >
                              <span className={`font-medium ${display.color}`}>
                                {display.emoji} {display.text}
                              </span>
                            </button>
                            <Tooltip offset={8} className="z-50">
                              {renderTooltipContent('verdict', hour)}
                            </Tooltip>
                          </TooltipTrigger>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={11}
                  className="py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  Aucune donnée horaire disponible
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
