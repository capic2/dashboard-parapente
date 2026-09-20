import type { MetricKey } from './FlightTelemetryOverlay';

export interface FlightTelemetryWidgetLayout {
  id: string;
  metric: MetricKey;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

/**
 * The interactive overlay layout is intentionally kept in one place so it
 * can be tuned without changing the telemetry rendering or interpolation.
 * Positions are relative to the video stage and use CSS lengths.
 */
export const DEFAULT_FLIGHT_TELEMETRY_LAYOUT = [
  { id: 'top-left', metric: 'altitude', top: '0.75rem', left: '0.75rem' },
  { id: 'top-right', metric: 'speed', top: '0.75rem', right: '0.75rem' },
  {
    id: 'bottom-left',
    metric: 'vario',
    bottom: '3.5rem',
    left: '0.75rem',
  },
  {
    id: 'bottom-right',
    metric: 'distance',
    bottom: '3.5rem',
    right: '0.75rem',
  },
] satisfies readonly FlightTelemetryWidgetLayout[];
