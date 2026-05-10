/**
 * WindIndicator Component
 *
 * Shows a visual indicator based on wind favorability
 * for a specific takeoff orientation.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import {
  getWindFavorability,
  getWindFavorabilityLabel,
  getWindFavorabilityColor,
} from '../../utils/windMatcher';

export interface WindIndicatorProps {
  windDirection?: string;
  siteOrientation?: string;
  windSpeed?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const getWindFavorabilityIcon = (favorability: string) => {
  if (favorability === 'good') return CheckCircle2;
  if (favorability === 'moderate') return AlertTriangle;
  if (favorability === 'bad') return XCircle;
  return CircleHelp;
};

export function WindIndicator({
  windDirection,
  siteOrientation,
  windSpeed,
  showLabel = true,
  size = 'md',
  className = '',
}: WindIndicatorProps) {
  const { t, i18n } = useTranslation();
  const favorability = getWindFavorability(
    windDirection,
    siteOrientation,
    windSpeed
  );
  const label = getWindFavorabilityLabel(favorability, i18n.language);
  const colorClass = getWindFavorabilityColor(favorability);
  const Icon = getWindFavorabilityIcon(favorability);

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
        <CircleHelp
          className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-400"
          aria-hidden="true"
        />
        {showLabel && (
          <span className="text-gray-400 dark:text-gray-400">
            {t('weather.windUnavailable')}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 ${sizeClasses[size]} ${className}`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${colorClass}`} aria-hidden="true" />
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
 * Compact version showing only an icon with tooltip
 */
export function WindIndicatorCompact({
  windDirection,
  siteOrientation,
  windSpeed,
  className = '',
}: WindIndicatorProps) {
  const { i18n } = useTranslation();
  const favorability = getWindFavorability(
    windDirection,
    siteOrientation,
    windSpeed
  );
  const label = getWindFavorabilityLabel(favorability, i18n.language);
  const colorClass = getWindFavorabilityColor(favorability);
  const Icon = getWindFavorabilityIcon(favorability);

  const tooltipText =
    windDirection && windSpeed != null
      ? `${label} - ${windDirection} ${windSpeed}km/h`
      : label;

  return (
    <span
      className={`inline-flex cursor-help ${className}`}
      title={tooltipText}
      aria-label={tooltipText}
    >
      <Icon className={`h-5 w-5 ${colorClass}`} aria-hidden="true" />
    </span>
  );
}
