import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  interpolateTelemetryAtVideoTime,
  type FlightTelemetryData,
  type FlightTelemetryPoint,
} from '../../../hooks/flights/useFlightTelemetry';
import {
  DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
  type FlightTelemetryWidgetLayout,
} from './flightTelemetryLayout';

export type MetricKey =
  | 'altitude'
  | 'speed'
  | 'vario'
  | 'distance'
  | 'heading'
  | 'heart_rate'
  | 'power';

interface FlightTelemetryOverlayProps {
  data?: FlightTelemetryData;
  videoTimeSeconds: number;
  offsetSeconds: number;
  timelineStartTimestamp?: number;
  layout?: readonly FlightTelemetryWidgetLayout[];
}

const METRIC_KEYS: MetricKey[] = [
  'altitude',
  'speed',
  'vario',
  'distance',
  'heading',
  'heart_rate',
  'power',
];

const getMetricValue = (
  point: FlightTelemetryPoint | null,
  metric: MetricKey
): [number | null | undefined, string] | null => {
  if (!point) return null;
  switch (metric) {
    case 'altitude':
      return [point.elevation, 'm'];
    case 'speed':
      return [point.speed_kmh, 'km/h'];
    case 'vario':
      return [point.vario_ms, 'm/s'];
    case 'distance':
      return [point.distance_km, 'km'];
    case 'heading':
      return [point.heading_deg, '°'];
    case 'heart_rate':
      return [point.heart_rate, 'bpm'];
    case 'power':
      return [point.power, 'W'];
  }
};

function formatValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return Math.abs(value) >= 100
    ? Math.round(value).toString()
    : value.toFixed(1);
}

const METRIC_LABELS: Record<MetricKey, string> = {
  altitude: 'telemetryAltitude',
  speed: 'telemetrySpeed',
  vario: 'telemetryVario',
  distance: 'telemetryDistance',
  heading: 'telemetryHeading',
  heart_rate: 'telemetryHeartRate',
  power: 'telemetryPower',
};

export function FlightTelemetryOverlay({
  data,
  videoTimeSeconds,
  offsetSeconds,
  timelineStartTimestamp,
  layout = DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
}: FlightTelemetryOverlayProps) {
  const { t } = useTranslation();
  const point = useMemo(
    () =>
      interpolateTelemetryAtVideoTime(
        data,
        videoTimeSeconds,
        offsetSeconds,
        timelineStartTimestamp
      ),
    [data, offsetSeconds, timelineStartTimestamp, videoTimeSeconds]
  );
  const [selectedMetrics, setSelectedMetrics] = useState<
    Record<string, MetricKey>
  >(
    () =>
      Object.fromEntries(
        layout.map((slot) => [slot.id, slot.metric])
      ) as Record<string, MetricKey>
  );

  return (
    <div className="pointer-events-none absolute inset-0">
      {layout.map((slot) => {
        const metric = selectedMetrics[slot.id] ?? slot.metric;
        const [value, unit] = getMetricValue(point, metric) ?? [null, ''];
        const nextMetric =
          METRIC_KEYS[(METRIC_KEYS.indexOf(metric) + 1) % METRIC_KEYS.length];
        return (
          <button
            key={slot.id}
            type="button"
            className="pointer-events-auto absolute min-w-24 cursor-pointer rounded-lg border border-white/25 bg-slate-950/75 px-3 py-2 text-left text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            style={{
              top: slot.top,
              right: slot.right,
              bottom: slot.bottom,
              left: slot.left,
            }}
            onClick={() =>
              setSelectedMetrics((current) => ({
                ...current,
                [slot.id]: nextMetric,
              }))
            }
            aria-label={`${t(`flights.${METRIC_LABELS[metric]}`)} ${formatValue(value)} ${unit}. ${t('flights.telemetryChangeMetric')}`}
          >
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-300">
              {t(`flights.${METRIC_LABELS[metric]}`)}
            </span>
            <span className="mt-0.5 block font-mono text-lg font-bold leading-none">
              {formatValue(value)}
              <span className="ml-1 text-xs font-normal text-slate-300">
                {unit}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
