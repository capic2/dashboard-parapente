import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  interpolateTelemetryAtVideoTime,
  type FlightTelemetryData,
  type FlightTelemetryPoint,
} from '../../../hooks/flights/useFlightTelemetry';

type MetricKey =
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
}: FlightTelemetryOverlayProps) {
  const { t } = useTranslation();
  const point = useMemo(
    () =>
      interpolateTelemetryAtVideoTime(data, videoTimeSeconds, offsetSeconds),
    [data, offsetSeconds, videoTimeSeconds]
  );
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([
    'altitude',
    'speed',
    'vario',
    'distance',
  ]);

  const positions = [
    'left-3 top-3',
    'right-3 top-3',
    'left-3 bottom-14',
    'right-3 bottom-14',
  ];

  return (
    <div className="pointer-events-none absolute inset-0">
      {selectedMetrics.map((metric, index) => {
        const [value, unit] = getMetricValue(point, metric) ?? [null, ''];
        const nextMetric =
          METRIC_KEYS[(METRIC_KEYS.indexOf(metric) + 1) % METRIC_KEYS.length];
        return (
          <button
            key={index}
            type="button"
            className={`pointer-events-auto absolute ${positions[index]} min-w-24 rounded-lg border border-white/25 bg-slate-950/75 px-3 py-2 text-left text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400`}
            onClick={() =>
              setSelectedMetrics((current) =>
                current.map((currentMetric, currentIndex) =>
                  currentIndex === index ? nextMetric : currentMetric
                )
              )
            }
            aria-label={t('flights.telemetryChangeMetric')}
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
