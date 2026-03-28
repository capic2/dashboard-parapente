/**
 * WindIndicator Component
 *
 * Shows a visual indicator (🟢/🟡/🔴) based on wind favorability
 * for a specific takeoff orientation.
 */

import {
  getWindFavorability,
  getWindFavorabilityEmoji,
  getWindFavorabilityLabel,
  getWindFavorabilityColor,
} from '../utils/windMatcher';

interface WindIndicatorProps {
  windDirection?: string;
  siteOrientation?: string;
  windSpeed?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function WindIndicator({
  windDirection,
  siteOrientation,
  windSpeed,
  showLabel = true,
  size = 'md',
  className = '',
}: WindIndicatorProps) {
  const favorability = getWindFavorability(
    windDirection,
    siteOrientation,
    windSpeed
  );
  const emoji = getWindFavorabilityEmoji(favorability);
  const label = getWindFavorabilityLabel(favorability, 'fr');
  const colorClass = getWindFavorabilityColor(favorability);

  // Size classes
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  // If no wind data, show unknown state
  if (!windDirection || windDirection === 'N/A') {
    return (
      <div
        className={`flex items-center gap-2 ${sizeClasses[size]} ${className}`}
      >
        <span className="text-gray-400">⚪</span>
        {showLabel && (
          <span className="text-gray-400">Données vent indisponibles</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 ${sizeClasses[size]} ${className}`}
    >
      <span className="text-xl">{emoji}</span>
      {showLabel && (
        <div className="flex flex-col">
          <span className={`font-medium ${colorClass}`}>{label}</span>
          {windDirection && windSpeed !== undefined && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {windDirection} {windSpeed}km/h
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact version showing only emoji with tooltip
 */
export function WindIndicatorCompact({
  windDirection,
  siteOrientation,
  windSpeed,
  className = '',
}: WindIndicatorProps) {
  const favorability = getWindFavorability(
    windDirection,
    siteOrientation,
    windSpeed
  );
  const emoji = getWindFavorabilityEmoji(favorability);
  const label = getWindFavorabilityLabel(favorability, 'fr');

  const tooltipText =
    windDirection && windSpeed
      ? `${label} - ${windDirection} ${windSpeed}km/h`
      : label;

  return (
    <span
      className={`text-xl cursor-help ${className}`}
      title={tooltipText}
      aria-label={tooltipText}
    >
      {emoji}
    </span>
  );
}
