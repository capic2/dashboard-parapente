import { useState, useEffect } from 'react';
import { useWeather } from '../../hooks/useWeather';

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

interface TooltipPosition {
  x: number;
  y: number;
}

interface BaseTooltipProps {
  position: TooltipPosition;
  hour: string;
  onClose?: () => void;
  isMobile?: boolean;
}

interface SourceDataTooltipProps extends BaseTooltipProps {
  sources: Record<string, any>;
  consensus: number | string | null;
  unit: string;
  fieldName: string;
  label: string;
  color: string;
}

interface ParaIndexTooltipProps extends BaseTooltipProps {
  paraIndex: number;
  wind: number;
  gust: number;
  precipitation: number;
  temperature: number;
}

interface VerdictTooltipProps extends BaseTooltipProps {
  verdict: string;
  paraIndex: number;
  wind: number;
  gust: number;
  precipitation: number;
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
const getFlyabilityDisplay = (
  hour: any
): { emoji: string; text: string; color: string } => {
  const verdict = hour.verdict?.toLowerCase();
  const verdictUpper = verdict?.toUpperCase() || 'MOYEN';

  // Emoji and color based on verdict
  let emoji = '🟡';
  let color = 'text-yellow-600';

  if (verdict === 'bon') {
    emoji = '🟢';
    color = 'text-green-600';
    return { emoji, text: 'BON', color };
  } else if (verdict === 'mauvais') {
    emoji = '🔴';
    color = 'text-red-600';
  } else if (verdict === 'limite') {
    emoji = '🟠';
    color = 'text-orange-600';
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
  if (precipitation > 0.5) {
    reason = 'Pluie';
  } else if (wind > 35) {
    reason = 'Vent fort';
  } else if (gust > 45) {
    reason = 'Rafales importantes';
  } else if (wind < 8) {
    reason = 'Vent insuffisant';
  } else if (wind < 15) {
    reason = 'Vent faible';
  } else if (cloudCover > 80) {
    reason = 'Très nuageux';
  } else if (wind > 25) {
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
  if (v === 'bon') return 'bg-green-50 hover:bg-green-100';
  if (v === 'moyen') return 'bg-yellow-50 hover:bg-yellow-100';
  if (v === 'limite') return 'bg-orange-50 hover:bg-orange-100';
  return 'bg-red-50 hover:bg-red-100';
};

const formatWindDirectionFromDegrees = (deg: number | null): string => {
  if (deg === null) return '—';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round((deg % 360) / 45) % 8;
  return directions[index];
};

const formatWindDirectionWithDegrees = (deg: number | null): string => {
  // Now returns cardinal only (no degrees) per user request
  return formatWindDirectionFromDegrees(deg);
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

// ============================================================================
// TOOLTIP COMPONENTS
// ============================================================================

const ParaIndexTooltip = ({
  position,
  hour,
  paraIndex,
  wind,
  gust,
  precipitation,
  temperature,
  onClose,
  isMobile,
}: ParaIndexTooltipProps) => {
  return (
    <div
      className={`
        ${isMobile ? 'fixed bottom-0 left-0 right-0 mx-4 mb-4' : 'fixed'}
        bg-white border-2 border-sky-500 rounded-lg shadow-xl p-4 z-50 text-sm
      `}
      style={
        isMobile
          ? {}
          : {
              left: `${position.x}px`,
              top: `${position.y - 10}px`,
              transform: 'translateX(-50%) translateY(-100%)',
              maxWidth: '320px',
            }
      }
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      )}
      <div className="font-bold mb-3 text-sky-700 flex items-center gap-2">
        📊 Para-Index - {hour}
      </div>
      <div className="space-y-2 text-gray-700">
        <div className="text-lg font-bold text-sky-600">{paraIndex}/100</div>
        <div className="border-t border-gray-200 pt-2 mt-2">
          <div className="text-xs font-semibold text-gray-500 mb-2">
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
        <div className="text-xs text-gray-500 mt-3">
          Score calculé selon les conditions optimales de vol
        </div>
      </div>
    </div>
  );
};

const VerdictTooltip = ({
  position,
  hour,
  verdict,
  paraIndex,
  wind,
  gust,
  precipitation,
  onClose,
  isMobile,
}: VerdictTooltipProps) => {
  const criteria = [
    {
      label: 'Vent dans plage optimale (8-15 km/h)',
      met: wind >= 8 && wind <= 15,
    },
    {
      label: 'Vent pas trop faible (> 5 km/h)',
      met: wind > 5,
    },
    {
      label: 'Vent pas trop fort (< 20 km/h)',
      met: wind < 20,
    },
    {
      label: 'Rafales acceptables (< 25 km/h)',
      met: gust < 25,
    },
    {
      label: 'Pas de précipitations',
      met: precipitation < 0.5,
    },
  ];

  return (
    <div
      className={`
        ${isMobile ? 'fixed bottom-0 left-0 right-0 mx-4 mb-4' : 'fixed'}
        bg-white border-2 border-emerald-500 rounded-lg shadow-xl p-4 z-50 text-sm
      `}
      style={
        isMobile
          ? {}
          : {
              left: `${position.x}px`,
              top: `${position.y - 10}px`,
              transform: 'translateX(-50%) translateY(-100%)',
              maxWidth: '320px',
            }
      }
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      )}
      <div className="font-bold mb-3 text-emerald-700 flex items-center gap-2">
        ✓ Verdict - {hour}
      </div>
      <div className="space-y-2 text-gray-700">
        <div className="text-lg font-bold capitalize text-emerald-600">
          {verdict}
        </div>
        <div className="text-xs text-gray-500">
          Para-Index : {paraIndex}/100
        </div>
        <div className="border-t border-gray-200 pt-2 mt-2">
          <div className="text-xs font-semibold text-gray-500 mb-2">
            Critères évalués :
          </div>
          <div className="space-y-1 text-xs">
            {criteria.map((criterion, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className={criterion.met ? 'text-green-500' : 'text-red-500'}
                >
                  {criterion.met ? '✓' : '✗'}
                </span>
                <span
                  className={criterion.met ? 'text-gray-700' : 'text-gray-500'}
                >
                  {criterion.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SourceDataTooltip = ({
  position,
  hour,
  sources,
  consensus,
  unit,
  fieldName,
  label,
  color,
  onClose,
  isMobile,
}: SourceDataTooltipProps) => {
  return (
    <div
      className={`
        ${isMobile ? 'fixed bottom-0 left-0 right-0 mx-4 mb-4' : 'fixed'}
        bg-white border-2 rounded-lg shadow-xl p-4 z-50 text-sm
      `}
      style={
        isMobile
          ? {}
          : {
              left: `${position.x}px`,
              top: `${position.y - 10}px`,
              transform: 'translateX(-50%) translateY(-100%)',
              maxWidth: '320px',
              borderColor: color,
            }
      }
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      )}
      <div className="font-bold mb-3 text-gray-800 flex items-center gap-2">
        {label} - {hour}
      </div>
      <div className="space-y-2">
        {SOURCE_ORDER.map((sourceKey) => {
          const sourceData = sources[sourceKey];
          const sourceName = SOURCE_NAMES[sourceKey] || sourceKey;

          if (!sourceData) {
            return (
              <div key={sourceKey} className="text-xs text-gray-400">
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
                className="text-xs text-gray-700 flex items-center justify-between gap-2"
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
                    className="text-blue-500 hover:text-blue-700 text-xs flex-shrink-0"
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
                className="text-xs text-gray-700 flex items-center justify-between gap-2"
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
                    className="text-blue-500 hover:text-blue-700 text-xs flex-shrink-0"
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
              <div key={sourceKey} className="text-xs text-gray-400">
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
              className="text-xs text-gray-700 flex items-center justify-between gap-2"
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
                  className="text-blue-500 hover:text-blue-700 text-xs"
                  title={`Ouvrir ${sourceName}`}
                >
                  ↗
                </a>
              )}
            </div>
          );
        })}

        <div className="border-t border-gray-200 pt-2 mt-2">
          <div className="text-xs font-bold text-gray-800">
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
  const { data: weather, isLoading, error } = useWeather(spotId, dayIndex);
  const [activeTooltip, setActiveTooltip] = useState<{
    type: CellType;
    data: any;
    position: TooltipPosition;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 mb-3 font-semibold">
          Prévisions Horaires
        </h2>
        <div className="py-5 text-center text-gray-500 text-sm">
          Chargement...
        </div>
      </div>
    );
  }

  if (error || !weather || !weather.hourly_forecast) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-md">
        <h2 className="text-sm text-gray-600 mb-3 font-semibold">
          Prévisions Horaires
        </h2>
        <div className="py-5 text-center text-red-500 text-sm">
          Données non disponibles
        </div>
      </div>
    );
  }

  const flyingHours = weather.hourly_forecast;

  const handleCellInteraction = (
    cellType: CellType,
    hourData: any,
    event: React.MouseEvent
  ) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    setActiveTooltip({
      type: cellType,
      data: hourData,
      position: { x, y },
    });
  };

  const handleCloseTooltip = () => {
    setActiveTooltip(null);
  };

  const renderTooltip = () => {
    if (!activeTooltip) return null;

    const { type, data, position } = activeTooltip;
    const commonProps = {
      position,
      hour: data.hour,
      onClose: handleCloseTooltip, // Always show close button
      isMobile,
    };

    switch (type) {
      case 'para-index':
        return (
          <ParaIndexTooltip
            {...commonProps}
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
            {...commonProps}
            verdict={data.verdict}
            paraIndex={data.para_index}
            wind={data.wind_speed || 0}
            gust={
              data.sources?.['open-meteo']?.wind_gust ||
              data.sources?.['weatherapi']?.wind_gust ||
              0
            }
            precipitation={data.precipitation || 0}
          />
        );

      case 'temperature':
        return (
          <SourceDataTooltip
            {...commonProps}
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
            {...commonProps}
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
            {...commonProps}
            sources={data.sources || {}}
            consensus={data.wind_gust}
            unit="km/h"
            fieldName="wind_gust"
            label="💨 Rafales"
            color="#dc2626"
          />
        );

      case 'direction':
        return (
          <SourceDataTooltip
            {...commonProps}
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
            {...commonProps}
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
            {...commonProps}
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

  const cellEventHandlers = (cellType: CellType, hourData: any) => {
    if (isMobile) {
      return {
        onClick: (e: React.MouseEvent) =>
          handleCellInteraction(cellType, hourData, e),
      };
    } else {
      return {
        onMouseEnter: (e: React.MouseEvent) =>
          handleCellInteraction(cellType, hourData, e),
        // onMouseLeave removed - tooltip stays open until close button clicked
      };
    }
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-md">
      <h2 className="text-sm text-gray-600 mb-3 font-semibold">
        Prévisions Horaires
      </h2>

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                Heure
              </th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                Para-Index
              </th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                Temp
              </th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                Vent
              </th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                Rafales
              </th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                Direction
              </th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                Précip.
              </th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                Nuages
              </th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                CAPE (J/kg)
              </th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                Thermiques
              </th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">
                Volabilité
              </th>
            </tr>
          </thead>
          <tbody>
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
                    className={`border-b border-gray-100 ${getVerdictClass(hour.verdict)}`}
                  >
                    <td className="py-2.5 px-2 font-medium">{hour.hour}</td>

                    <td
                      className="py-2.5 px-2 cursor-pointer hover:bg-sky-100 transition-colors"
                      {...cellEventHandlers('para-index', hour)}
                    >
                      <strong className="text-sky-600">
                        {hour.para_index}/100
                      </strong>
                    </td>

                    <td
                      className="py-2.5 px-2 cursor-pointer hover:bg-red-50 transition-colors"
                      {...cellEventHandlers('temperature', hour)}
                    >
                      {hour.temp}°C
                    </td>

                    <td
                      className="py-2.5 px-2 cursor-pointer hover:bg-blue-50 transition-colors"
                      {...cellEventHandlers('wind', hour)}
                    >
                      {hour.wind} km/h
                    </td>

                    <td
                      className="py-2.5 px-2 cursor-pointer hover:bg-red-50 transition-colors"
                      {...cellEventHandlers('gust', hour)}
                    >
                      {gustValue !== null && gustValue !== undefined
                        ? `${gustValue.toFixed(1)} km/h`
                        : '—'}
                    </td>

                    <td
                      className="py-2.5 px-2 cursor-pointer hover:bg-violet-50 transition-colors"
                      {...cellEventHandlers('direction', hour)}
                    >
                      {hour.direction}
                    </td>

                    <td
                      className="py-2.5 px-2 cursor-pointer hover:bg-cyan-50 transition-colors"
                      {...cellEventHandlers('precipitation', hour)}
                    >
                      {hour.precipitation !== null &&
                      hour.precipitation !== undefined
                        ? `${hour.precipitation.toFixed(1)} mm`
                        : '—'}
                    </td>

                    <td
                      className="py-2.5 px-2 cursor-pointer hover:bg-slate-50 transition-colors"
                      {...cellEventHandlers('cloud-cover', hour)}
                    >
                      {cloudCover !== null && cloudCover !== undefined
                        ? `${Math.round(cloudCover)}%`
                        : '—'}
                    </td>

                    <td className="py-2.5 px-2">
                      {hour.cape !== null && hour.cape !== undefined
                        ? Math.round(hour.cape)
                        : '—'}
                    </td>

                    <td className="py-2.5 px-2">
                      {hour.thermal_strength || 'Faible'}
                    </td>

                    <td className="py-2.5 px-2">
                      {(() => {
                        const display = getFlyabilityDisplay(hour);
                        return (
                          <span className={`font-medium ${display.color}`}>
                            {display.emoji} {display.text}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="py-8 text-center text-gray-500">
                  Aucune donnée horaire disponible
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Render active tooltip */}
      {renderTooltip()}
    </div>
  );
}
