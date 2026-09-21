import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  interpolateTelemetryAtVideoTime,
  type FlightTelemetryData,
} from '../../../hooks/flights/useFlightTelemetry';
import {
  DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
  type FlightTelemetryLayoutItem,
} from './flightTelemetryLayout';
import {
  METRIC_LABELS,
  getTelemetryMetricValue,
  formatTelemetryValue,
  type MetricKey,
} from './telemetryMetrics';
import { TelemetryLayoutIcon } from '../../telemetry/TelemetryLayoutIcon';

const CYCLE_METRICS: MetricKey[] = [
  'altitude',
  'speed',
  'vario',
  'distance',
  'heading',
  'heart_rate',
  'power',
];

interface FlightTelemetryOverlayProps {
  data?: FlightTelemetryData;
  videoTimeSeconds: number;
  offsetSeconds: number;
  timelineStartTimestamp?: number;
  layout?: readonly FlightTelemetryLayoutItem[];
}

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
        layout
          .filter((slot) => slot.type === 'widget')
          .map((slot) => [slot.id, slot.metric])
      ) as Record<string, MetricKey>
  );

  useEffect(() => {
    setSelectedMetrics(
      Object.fromEntries(
        layout
          .filter((slot) => slot.type === 'widget')
          .map((slot) => [slot.id, slot.metric])
      ) as Record<string, MetricKey>
    );
  }, [layout]);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ containerType: 'inline-size' }}
    >
      {layout
        .filter((slot) => slot.visible)
        .map((slot) => {
          if (slot.type === 'icon') {
            return (
              <div
                key={slot.id}
                className={`pointer-events-auto absolute flex items-center justify-center rounded-lg border text-white shadow-lg backdrop-blur-sm ${slot.transparent ? 'bg-transparent' : 'bg-slate-950/75'} ${slot.border === false ? 'border-transparent' : 'border-white/25'}`}
                style={{
                  left: `${slot.x * 100}%`,
                  top: `${slot.y * 100}%`,
                  width: `${slot.width * 100}%`,
                  height: `${slot.height * 100}%`,
                }}
              >
                <TelemetryLayoutIcon name={slot.icon} className="h-1/2 w-1/2" />
              </div>
            );
          }
          if (slot.type === 'text') {
            return (
              <div
                key={slot.id}
                className={`pointer-events-auto absolute flex items-center justify-center overflow-hidden rounded-lg border px-2 text-center text-sm font-semibold text-white shadow-lg backdrop-blur-sm ${slot.transparent ? 'bg-transparent' : 'bg-slate-950/75'} ${slot.border === false ? 'border-transparent' : 'border-white/25'}`}
                style={{
                  left: `${slot.x * 100}%`,
                  top: `${slot.y * 100}%`,
                  width: `${slot.width * 100}%`,
                  height: `${slot.height * 100}%`,
                }}
              >
                <span className="truncate">{slot.content}</span>
              </div>
            );
          }
          const metric = selectedMetrics[slot.id] ?? slot.metric;
          const [value, unit] = getTelemetryMetricValue(
            point,
            data,
            metric
          ) ?? [null, ''];
          const nextMetric =
            CYCLE_METRICS[
              (CYCLE_METRICS.indexOf(metric) + 1) % CYCLE_METRICS.length
            ];
          return (
            <button
              key={slot.id}
              type="button"
              className={`pointer-events-auto absolute min-h-0 min-w-0 overflow-hidden cursor-pointer rounded-lg border px-3 py-2 text-left text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${slot.transparent ? 'bg-transparent' : 'bg-slate-950/75'} ${slot.border === false ? 'border-transparent' : 'border-white/25'}`}
              style={{
                left: `${slot.x * 100}%`,
                top: `${slot.y * 100}%`,
                width: `${slot.width * 100}%`,
                height: `${slot.height * 100}%`,
                fontSize: `${((slot.fontSize ?? 32) / 1920) * 100}cqw`,
              }}
              onClick={() =>
                setSelectedMetrics((current) => ({
                  ...current,
                  [slot.id]: nextMetric,
                }))
              }
              aria-label={`${t(`flights.${METRIC_LABELS[metric]}`)} ${formatTelemetryValue(value)} ${unit}. ${t('flights.telemetryChangeMetric')}`}
            >
              {slot.showLabel !== false && (
                <span
                  className="block font-semibold uppercase tracking-wide text-slate-300"
                  style={{ fontSize: '0.35em' }}
                >
                  {t(`flights.${METRIC_LABELS[metric]}`)}
                </span>
              )}
              <span
                className="mt-0.5 block font-mono font-bold leading-none"
                style={{ fontSize: '1em' }}
              >
                {formatTelemetryValue(value)}
                <span
                  className="ml-1 font-normal text-slate-300"
                  style={{ fontSize: '0.45em' }}
                >
                  {unit}
                </span>
              </span>
            </button>
          );
        })}
    </div>
  );
}
