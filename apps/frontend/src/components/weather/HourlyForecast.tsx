import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
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
  RefreshCw,
} from 'lucide-react';
import { useAppSettings } from '../../hooks/settings/useAppSettings';
import { useWeather } from '../../hooks/weather/useWeather';
import type { HourlyForecastItem, WeatherData } from '../../types';
import CacheTimestamp from '../common/CacheTimestamp';
import WindArrow from './WindArrow';
import {
  getVerdictVisual,
  weatherCardClassName,
  weatherSectionTitleClassName,
} from './weatherUi';

interface HourlyForecastProps {
  spotId?: string;
  dayIndex?: number;
  weatherData?: WeatherData;
  isLoading?: boolean;
  isError?: boolean;
  canForceRefresh?: boolean;
  isForceRefreshing?: boolean;
  onForceRefresh?: () => void;
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
  sourceFreshness?: HourlyForecastItem['source_freshness'];
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

type FlyabilityReasonLabels = {
  rain: string;
  strongWind: string;
  strongGusts: string;
  insufficientWind: string;
  weakWind: string;
  acceptableWind: string;
  veryCloudy: string;
  moderateWind: string;
  averageConditions: string;
  thunderstorms: string;
  thunderstormRisk: string;
};

const DEFAULT_FLYABILITY_REASON_LABELS: FlyabilityReasonLabels = {
  rain: 'Pluie',
  strongWind: 'Vent fort',
  strongGusts: 'Rafales importantes',
  insufficientWind: 'Vent insuffisant',
  weakWind: 'Vent faible',
  acceptableWind: 'Vent acceptable',
  veryCloudy: 'Très nuageux',
  moderateWind: 'Vent modéré',
  averageConditions: 'Conditions moyennes',
  thunderstorms: 'Orages',
  thunderstormRisk: "Risque d'orage",
};

type ThunderstormRisk = 'nul' | 'faible' | 'modere' | 'eleve';

const THUNDERSTORM_RISK_RANKS: Record<ThunderstormRisk, number> = {
  nul: 0,
  faible: 1,
  modere: 2,
  eleve: 3,
};

const maxThunderstormRisk = (
  left: ThunderstormRisk,
  right: ThunderstormRisk
): ThunderstormRisk => {
  return THUNDERSTORM_RISK_RANKS[left] >= THUNDERSTORM_RISK_RANKS[right]
    ? left
    : right;
};

const getLiftedIndexRisk = (
  liftedIndex: number | null | undefined
): ThunderstormRisk => {
  if (liftedIndex == null) return 'nul';
  if (liftedIndex <= -7) return 'eleve';
  if (liftedIndex <= -5) return 'modere';
  if (liftedIndex <= -3) return 'faible';
  return 'nul';
};

const getCapeRisk = (cape: number | null | undefined): ThunderstormRisk => {
  if (cape == null) return 'nul';
  if (cape >= 2500) return 'eleve';
  if (cape >= 1500) return 'modere';
  if (cape >= 300) return 'faible';
  return 'nul';
};

const getThunderstormRisk = (
  cape: number | null | undefined,
  liftedIndex: number | null | undefined
): ThunderstormRisk => {
  const capeRisk = getCapeRisk(cape);
  const liftedIndexRisk = getLiftedIndexRisk(liftedIndex);

  if (
    cape != null &&
    liftedIndex != null &&
    cape >= 1500 &&
    liftedIndex <= -4
  ) {
    return 'eleve';
  }
  if (cape != null && liftedIndex != null && cape >= 800 && liftedIndex <= -2) {
    return maxThunderstormRisk(
      'modere',
      maxThunderstormRisk(capeRisk, liftedIndexRisk)
    );
  }

  return maxThunderstormRisk(capeRisk, liftedIndexRisk);
};

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
    case 'open-meteo-icon':
      return 'https://open-meteo.com/';
    case 'open-meteo-gfs':
      return 'https://open-meteo.com/';
    case 'weatherapi':
      return 'https://www.weatherapi.com/';
    case 'met-no':
      return 'https://www.met.no/en/free-meteorological-data';
    case 'meteo-parapente':
      return 'https://meteo-parapente.com/';
    case 'meteociel':
      return 'https://www.meteociel.fr/';
    case 'meteoblue':
      return 'https://www.meteoblue.com/';
    case 'openweathermap':
      return 'https://openweathermap.org/';
    default:
      return null;
  }
};

/**
 * Get flyability display with verdict and reason.
 */
export const getFlyabilityDisplay = (
  hour: HourlyForecastItem,
  thresholds: UiThresholds,
  reasonLabels: FlyabilityReasonLabels = DEFAULT_FLYABILITY_REASON_LABELS
): {
  text: string;
  color: string;
  Icon: ReturnType<typeof getVerdictVisual>['Icon'];
} => {
  const thunderstormRisk = getThunderstormRisk(hour.cape, hour.lifted_index);

  if (thunderstormRisk === 'eleve') {
    const visual = getVerdictVisual('mauvais');
    return {
      text: `MAUVAIS — ${reasonLabels.thunderstorms}`,
      color: visual.textClassName,
      Icon: visual.Icon,
    };
  }

  if (thunderstormRisk === 'modere') {
    const visual = getVerdictVisual('moyen');
    return {
      text: `MOYEN — ${reasonLabels.thunderstormRisk}`,
      color: visual.textClassName,
      Icon: visual.Icon,
    };
  }

  const verdict = hour.verdict?.toLowerCase();
  const verdictUpper = verdict?.toUpperCase() || 'MOYEN';
  const visual = getVerdictVisual(verdict || 'moyen');
  let color = visual.textClassName;

  if (verdict === 'bon') {
    return { text: 'BON', color, Icon: visual.Icon };
  } else if (verdict === 'mauvais') {
    color = visual.textClassName;
  } else if (verdict === 'limite') {
    color = visual.textClassName;
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
    reason = reasonLabels.rain;
  } else if (gust >= thresholds.gustHighMax) {
    reason = reasonLabels.strongGusts;
  } else if (wind > thresholds.reasonWindVeryStrongMin) {
    reason = reasonLabels.strongWind;
  } else if (gust > thresholds.reasonGustHighMin) {
    reason = reasonLabels.strongGusts;
  } else if (wind < thresholds.windLowMax) {
    reason = reasonLabels.insufficientWind;
  } else if (wind < thresholds.windWeakMax) {
    reason = reasonLabels.weakWind;
  } else if (wind < thresholds.windOptimalMax) {
    reason = reasonLabels.acceptableWind;
  } else if (cloudCover > thresholds.reasonCloudVeryCloudyMin) {
    reason = reasonLabels.veryCloudy;
  } else if (wind > thresholds.reasonWindModerateMin) {
    reason = reasonLabels.moderateWind;
  } else {
    // Generic reason based on para-index
    reason = reasonLabels.averageConditions;
  }

  return {
    text: `${verdictUpper} — ${reason}`,
    color,
    Icon: visual.Icon,
  };
};

const getVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  return getVerdictVisual(v).softClassName;
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

const formatConsensusValue = (value: number | string | null): string => {
  if (value === null) return '—';
  return typeof value === 'number' ? value.toFixed(1) : value;
};

const SOURCE_NAMES: Record<string, string> = {
  'open-meteo': 'Open-Meteo AROME',
  'open-meteo-icon': 'Open-Meteo ICON',
  'open-meteo-gfs': 'Open-Meteo GFS',
  weatherapi: 'WeatherAPI',
  'met-no': 'MET Norway',
  'meteo-parapente': 'Météo-parapente',
  meteociel: 'Meteociel',
  meteoblue: 'Meteoblue',
  openweathermap: 'OpenWeatherMap',
};

const SOURCE_ORDER = [
  'open-meteo',
  'open-meteo-icon',
  'open-meteo-gfs',
  'weatherapi',
  'met-no',
  'meteo-parapente',
  'meteociel',
  'meteoblue',
  'openweathermap',
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
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-sky-500 rounded-lg shadow-xl p-4 text-sm max-w-[320px]">
      <div className="font-bold mb-3 text-sky-700 dark:text-sky-400 pr-8">
        <span>
          {label} - {hour}
        </span>
      </div>
      <div className="space-y-2 text-gray-700 dark:text-gray-300">
        <div className="text-lg font-bold text-sky-600 dark:text-sky-400">
          {paraIndex}/100
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
            {t('weather.metricsUsed')}
          </div>
          <div className="space-y-1 text-xs">
            <div>
              • {t('weather.avgWind')}: <strong>{wind.toFixed(1)} km/h</strong>
            </div>
            <div>
              • {t('weather.maxGust')}: <strong>{gust.toFixed(1)} km/h</strong>
            </div>
            <div>
              • {t('weather.precipitationLabel')}:{' '}
              <strong>{precipitation.toFixed(1)} mm</strong>
            </div>
            <div>
              • {t('common.temperature')}:{' '}
              <strong>{temperature.toFixed(1)}°C</strong>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          {t('weather.paraIndexHelp')}
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
  const { t } = useTranslation();
  const criteria = [
    {
      label: t('weather.criteria.windOptimalRange', {
        min: thresholds.windWeakMax,
        max: thresholds.windOptimalMax,
      }),
      met: wind >= thresholds.windWeakMax && wind <= thresholds.windOptimalMax,
    },
    {
      label: t('weather.criteria.windNotTooLow', {
        min: thresholds.windLowMax,
      }),
      met: wind > thresholds.windLowMax,
    },
    {
      label: t('weather.criteria.windNotTooHigh', {
        max: thresholds.windHighMax,
      }),
      met: wind < thresholds.windHighMax,
    },
    {
      label: t('weather.criteria.gustAcceptable', {
        max: thresholds.gustHighMax,
      }),
      met: gust < thresholds.gustHighMax,
    },
    {
      label: t('weather.criteria.noPrecipitation'),
      met: precipitation < thresholds.slotPrecipitationMax,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-emerald-500 rounded-lg shadow-xl p-4 text-sm max-w-[320px]">
      <div className="font-bold mb-3 text-emerald-700 dark:text-emerald-400 pr-8">
        <span>
          ✓ {t('weather.verdictLabel')} - {hour}
        </span>
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
            {t('weather.criteriaEvaluated')}
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
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{t('weather.reasonsTextualFlyability')}</span>
        </div>
      </div>
    </div>
  );
};

const SourceDataTooltip = ({
  hour,
  sources,
  sourceFreshness,
  consensus,
  unit,
  fieldName,
  label,
  color,
}: SourceDataTooltipProps) => {
  const { t } = useTranslation();
  const sourceKeys = [
    ...SOURCE_ORDER,
    ...Object.keys(sources).filter(
      (sourceKey) => !SOURCE_ORDER.includes(sourceKey)
    ),
  ];

  return (
    <div
      className="bg-white dark:bg-gray-800 border-2 rounded-lg shadow-xl p-4 text-sm max-w-[320px]"
      style={{ borderColor: color }}
    >
      <div className="font-bold mb-3 text-gray-800 dark:text-gray-100 flex items-center gap-2">
        {label} - {hour}
      </div>
      <div className="space-y-2">
        {sourceKeys.map((sourceKey) => {
          const sourceData = sources[sourceKey];
          const sourceName = SOURCE_NAMES[sourceKey] || sourceKey;
          const staleLabel = sourceFreshness?.[sourceKey]?.is_stale
            ? ` (${t('weather.staleSourceData')})`
            : '';

          if (!sourceData) {
            return (
              <div
                key={sourceKey}
                className="text-xs text-gray-400 dark:text-gray-400"
              >
                <span className="font-semibold">{sourceName}:</span>
                {staleLabel} ({t('weather.notAvailable')})
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
                ? ` (${t('weather.gustsShort')}: ${gust.toFixed(1)} km/h)`
                : '';
            return (
              <div
                key={sourceKey}
                className="text-xs text-gray-700 dark:text-gray-300 flex items-center justify-between gap-2"
              >
                <span>
                  <span className="font-semibold">{sourceName}:</span>
                  {staleLabel} {displayValue}
                  {gustValue}
                </span>
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs flex-shrink-0"
                    title={t('weather.openSource', { source: sourceName })}
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
                  <span className="font-semibold">{sourceName}:</span>
                  {staleLabel} {displayValue}
                </span>
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs flex-shrink-0"
                    title={t('weather.openSource', { source: sourceName })}
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
                <span className="font-semibold">{sourceName}:</span>
                {staleLabel} ({t('weather.notAvailable')})
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
                <span className="font-semibold">{sourceName}:</span>
                {staleLabel} {displayValue} {unit}
              </span>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs"
                  title={t('weather.openSource', { source: sourceName })}
                >
                  ↗
                </a>
              )}
            </div>
          );
        })}

        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
          <div className="text-xs font-bold text-gray-800 dark:text-gray-100">
            {t('weather.consensus')}: {formatConsensusValue(consensus)}{' '}
            {consensus === null ? '' : unit}
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
  weatherData,
  isLoading: isOverrideLoading,
  isError: isOverrideError,
  canForceRefresh = false,
  isForceRefreshing = false,
  onForceRefresh,
}: HourlyForecastProps) {
  const { t } = useTranslation();
  const {
    data: fetchedWeather,
    isLoading: isFetchedLoading,
    error,
  } = useWeather(weatherData ? undefined : spotId, dayIndex);
  const { data: appSettings } = useAppSettings();
  const weather = weatherData ?? fetchedWeather;
  const isLoading = isOverrideLoading ?? isFetchedLoading;
  const hasError = isOverrideError ?? !!error;
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
  const flyabilityReasonLabels: FlyabilityReasonLabels = {
    rain: t('weather.hourly.reasons.rain'),
    strongWind: t('weather.hourly.reasons.strongWind'),
    strongGusts: t('weather.hourly.reasons.strongGusts'),
    insufficientWind: t('weather.hourly.reasons.insufficientWind'),
    weakWind: t('weather.hourly.reasons.weakWind'),
    acceptableWind: t('weather.hourly.reasons.acceptableWind'),
    veryCloudy: t('weather.hourly.reasons.veryCloudy'),
    moderateWind: t('weather.hourly.reasons.moderateWind'),
    averageConditions: t('weather.hourly.reasons.averageConditions'),
    thunderstorms: t('weather.hourly.reasons.thunderstorms'),
    thunderstormRisk: t('weather.hourly.reasons.thunderstormRisk'),
  };

  if (isLoading) {
    return (
      <div className={`${weatherCardClassName} p-4`} aria-live="polite">
        <div className="mb-3">
          <h2 className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
            {t('weather.hourly.title')}
          </h2>
        </div>
        <div className="py-5 text-center text-gray-500 dark:text-gray-400 text-sm">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (hasError || !weather || !weather.hourly_forecast) {
    return (
      <div className={`${weatherCardClassName} p-4`} role="alert">
        <div className="mb-3">
          <h2 className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
            {t('weather.hourly.title')}
          </h2>
        </div>
        <div className="py-5 text-center text-red-500 dark:text-red-400 text-sm">
          {t('common.dataUnavailable')}
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
            sourceFreshness={data.source_freshness}
            consensus={data.temperature}
            unit="°C"
            fieldName="temperature"
            label={t('common.temperature')}
            color="#dc2626"
          />
        );

      case 'wind':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            sourceFreshness={data.source_freshness}
            consensus={data.wind_speed}
            unit="km/h"
            fieldName="wind_speed"
            label={t('common.wind')}
            color="#2563eb"
          />
        );

      case 'gust':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            sourceFreshness={data.source_freshness}
            consensus={data.wind_gust ?? null}
            unit="km/h"
            fieldName="wind_gust"
            label={t('common.gusts')}
            color="#dc2626"
          />
        );

      case 'direction':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            sourceFreshness={data.source_freshness}
            consensus={formatWindDirectionWithDegrees(
              data.sources?.['open-meteo']?.wind_direction ||
                data.sources?.['weatherapi']?.wind_direction ||
                null
            )}
            unit=""
            fieldName="wind_direction"
            label={t('weather.hourly.direction')}
            color="#7c3aed"
          />
        );

      case 'precipitation':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            sourceFreshness={data.source_freshness}
            consensus={data.precipitation}
            unit="mm"
            fieldName="precipitation"
            label={t('weather.precipitationLabel')}
            color="#0891b2"
          />
        );

      case 'cloud-cover':
        return (
          <SourceDataTooltip
            hour={data.hour}
            sources={data.sources || {}}
            sourceFreshness={data.source_freshness}
            consensus={
              data.sources?.['open-meteo']?.cloud_cover ||
              data.sources?.['weatherapi']?.cloud_cover ||
              null
            }
            unit="%"
            fieldName="cloud_cover"
            label={t('weather.hourly.cloudCover')}
            color="#64748b"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={`${weatherCardClassName} min-w-0 p-4 sm:p-5`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className={weatherSectionTitleClassName}>
            {t('weather.hourly.title')}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t('weather.hourly.description')}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <CacheTimestamp cachedAt={weather.cached_at} />
          {canForceRefresh && onForceRefresh && (
            <Button
              onPress={onForceRefresh}
              isDisabled={isForceRefreshing}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isForceRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {isForceRefreshing
                ? t('weather.refreshingData')
                : t('weather.refreshData')}
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-3 md:hidden">
        {flyingHours.length > 0 ? (
          flyingHours.map((hour, index) => {
            const cloudCover =
              hour.cloud_cover ??
              hour.sources?.['open-meteo']?.cloud_cover ??
              hour.sources?.['weatherapi']?.cloud_cover ??
              null;
            const gustValue =
              hour.wind_gust ??
              hour.sources?.['open-meteo']?.wind_gust ??
              hour.sources?.['weatherapi']?.wind_gust ??
              null;
            const display = getFlyabilityDisplay(
              hour,
              uiThresholds,
              flyabilityReasonLabels
            );
            const FlyabilityIcon = display.Icon;

            return (
              <article
                key={index}
                className={`rounded-2xl border border-slate-200 p-3 shadow-sm dark:border-slate-700 ${getVerdictClass(hour.verdict)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-sm font-black text-slate-950 dark:text-white">
                      <Clock
                        className="h-4 w-4 text-slate-500"
                        aria-hidden="true"
                      />
                      {hour.hour}
                    </div>
                    <div
                      className={`mt-1 inline-flex items-center gap-1.5 text-sm font-bold ${display.color}`}
                    >
                      <FlyabilityIcon className="h-4 w-4" aria-hidden="true" />
                      {display.text}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
                      {hour.para_index}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      /100
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-white/80 bg-white/85 p-2 dark:border-slate-800 dark:bg-slate-950/55">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <Wind
                        className="h-3.5 w-3.5 text-sky-500"
                        aria-hidden="true"
                      />
                      {t('common.wind')}
                    </span>
                    <div className="font-bold text-slate-950 dark:text-white">
                      {hour.wind}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white/85 p-2 dark:border-slate-800 dark:bg-slate-950/55">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <Zap
                        className="h-3.5 w-3.5 text-orange-500"
                        aria-hidden="true"
                      />
                      {t('common.gusts')}
                    </span>
                    <div className="font-bold text-slate-950 dark:text-white">
                      {gustValue !== null && gustValue !== undefined
                        ? `${gustValue.toFixed(1)} km/h`
                        : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white/85 p-2 dark:border-slate-800 dark:bg-slate-950/55">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <Compass
                        className="h-3.5 w-3.5 text-violet-500"
                        aria-hidden="true"
                      />
                      {t('weather.hourly.direction')}
                    </span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-950 dark:text-white">
                      {hour.wind_direction_deg === null ||
                      typeof hour.wind_direction_deg === 'undefined' ? (
                        '—'
                      ) : (
                        <>
                          <WindArrow
                            degrees={hour.wind_direction_deg}
                            className="text-violet-600 dark:text-violet-400"
                          />
                          <span>
                            {formatWindDirectionWithDegrees(
                              hour.wind_direction_deg
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white/85 p-2 dark:border-slate-800 dark:bg-slate-950/55">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <CloudRain
                        className="h-3.5 w-3.5 text-cyan-500"
                        aria-hidden="true"
                      />
                      {t('weather.rain')}
                    </span>
                    <div className="font-bold text-slate-950 dark:text-white">
                      {hour.precipitation !== null &&
                      hour.precipitation !== undefined
                        ? `${hour.precipitation.toFixed(1)} mm`
                        : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white/85 p-2 dark:border-slate-800 dark:bg-slate-950/55">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <Cloud
                        className="h-3.5 w-3.5 text-slate-500"
                        aria-hidden="true"
                      />
                      {t('weather.hourly.clouds')}
                    </span>
                    <div className="font-bold text-slate-950 dark:text-white">
                      {cloudCover !== null && cloudCover !== undefined
                        ? `${Math.round(cloudCover)}%`
                        : '—'}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-xl border border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('weather.hourly.noData')}
          </div>
        )}
      </div>

      <div className="hidden max-w-full min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain rounded-2xl border border-gray-200 dark:border-gray-700 md:block">
        <table
          aria-label={t('weather.hourly.title')}
          className="w-full min-w-[800px] text-sm"
        >
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur dark:bg-slate-950/95">
            <tr
              aria-label={t('weather.hourly.title')}
              className="border-b border-gray-200 dark:border-gray-700"
            >
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Clock size={14} aria-hidden="true" /> {t('common.time')}
                </span>
              </th>
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <CircleCheck size={14} aria-hidden="true" />{' '}
                  {t('weather.hourly.flyability')}
                </span>
              </th>
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Gauge size={14} aria-hidden="true" />{' '}
                  {t('weather.paraIndex')}
                </span>
              </th>
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Wind size={14} aria-hidden="true" />{' '}
                  {t('weather.hourly.windWithUnit')}
                </span>
              </th>
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Zap size={14} aria-hidden="true" />{' '}
                  {t('weather.hourly.gustsWithUnit')}
                </span>
              </th>
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Compass size={14} aria-hidden="true" />{' '}
                  {t('weather.hourly.direction')}
                </span>
              </th>
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Thermometer size={14} aria-hidden="true" />{' '}
                  {t('weather.hourly.tempWithUnit')}
                </span>
              </th>
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <CloudRain size={14} aria-hidden="true" />{' '}
                  {t('weather.hourly.precipitationWithUnit')}
                </span>
              </th>
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Cloud size={14} aria-hidden="true" />{' '}
                  {t('weather.hourly.cloudsWithUnit')}
                </span>
              </th>
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Zap size={14} aria-hidden="true" /> CAPE (J/kg)
                </span>
              </th>
              <th className="px-2 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center justify-center gap-1">
                  <Flame size={14} aria-hidden="true" />{' '}
                  {t('weather.hourly.thermals')}
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
                    className={`border-b border-gray-100 transition-colors dark:border-gray-700 ${getVerdictClass(hour.verdict)}`}
                  >
                    <td className="py-2.5 px-2 font-medium text-center">
                      {hour.hour}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {(() => {
                        const display = getFlyabilityDisplay(
                          hour,
                          uiThresholds,
                          flyabilityReasonLabels
                        );
                        const FlyabilityIcon = display.Icon;
                        return (
                          <TooltipTrigger delay={150} closeDelay={100}>
                            <Button
                              aria-label={t('weather.hourly.verdictAt', {
                                hour: hour.hour,
                              })}
                              className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                            >
                              <span
                                className={`inline-flex items-center justify-center gap-1 font-medium ${display.color}`}
                              >
                                <FlyabilityIcon
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {display.text}
                              </span>
                            </Button>
                            <Tooltip offset={8} className="z-50">
                              {renderTooltipContent('verdict', hour)}
                            </Tooltip>
                          </TooltipTrigger>
                        );
                      })()}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <Button
                          aria-label={t('weather.hourly.paraIndexAt', {
                            hour: hour.hour,
                          })}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
                        >
                          <strong className="text-sky-600 dark:text-sky-400">
                            {hour.para_index}/100
                          </strong>
                        </Button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('para-index', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <Button
                          aria-label={t('weather.hourly.windAt', {
                            hour: hour.hour,
                          })}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          {hour.wind}
                        </Button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('wind', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <Button
                          aria-label={t('weather.hourly.gustsAt', {
                            hour: hour.hour,
                          })}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          {gustValue !== null && gustValue !== undefined
                            ? gustValue.toFixed(1)
                            : '—'}
                        </Button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('gust', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <Button
                          aria-label={t('weather.hourly.directionAt', {
                            hour: hour.hour,
                          })}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors flex justify-center"
                        >
                          {hour.wind_direction_deg == null ? (
                            '—'
                          ) : (
                            <WindArrow
                              degrees={hour.wind_direction_deg}
                              className="text-violet-600 dark:text-violet-400"
                            />
                          )}
                        </Button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('direction', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <Button
                          aria-label={t('weather.hourly.temperatureAt', {
                            hour: hour.hour,
                          })}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          {hour.temp}
                        </Button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('temperature', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <Button
                          aria-label={t('weather.hourly.precipitationAt', {
                            hour: hour.hour,
                          })}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                        >
                          {hour.precipitation !== null &&
                          hour.precipitation !== undefined
                            ? hour.precipitation.toFixed(1)
                            : '—'}
                        </Button>
                        <Tooltip offset={8} className="z-50">
                          {renderTooltipContent('precipitation', hour)}
                        </Tooltip>
                      </TooltipTrigger>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <TooltipTrigger delay={150} closeDelay={100}>
                        <Button
                          aria-label={t('weather.hourly.cloudsAt', {
                            hour: hour.hour,
                          })}
                          className="w-full p-0 bg-transparent border-none cursor-help rounded hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors"
                        >
                          {cloudCover !== null && cloudCover !== undefined
                            ? Math.round(cloudCover)
                            : '—'}
                        </Button>
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
                      {hour.thermal_strength || t('weather.hourly.weak')}
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
                  {t('weather.hourly.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
