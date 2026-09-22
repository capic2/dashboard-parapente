import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  interpolateTelemetryAtVideoTime,
  type FlightTelemetryData,
} from '../../../hooks/flights/useFlightTelemetry';
import {
  DEFAULT_FLIGHT_TELEMETRY_LAYOUT,
  type TelemetryLayout,
  type FlightTelemetryLayoutItem,
} from './flightTelemetryLayout';
import {
  METRIC_LABELS,
  getTelemetryMetricValue,
  formatTelemetryValue,
  type MetricKey,
} from './telemetryMetrics';
import { TelemetryLayoutIcon } from '../../telemetry/TelemetryLayoutIcon';
import { TelemetrySpeedometer } from '../../telemetry/TelemetrySpeedometer';

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
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const backgroundImage = (layout as TelemetryLayout).backgroundImage;
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
      style={{
        containerType: 'inline-size',
        backgroundImage: backgroundImage
          ? `url(${JSON.stringify(backgroundImage)})`
          : undefined,
        backgroundSize: backgroundImage ? 'cover' : undefined,
        backgroundPosition: backgroundImage ? 'center' : undefined,
      }}
    >
      {layout
        .filter((slot) => slot.visible)
        .map((slot) => {
          if (slot.type === 'icon') {
            return (
              <div
                key={slot.id}
                className={`pointer-events-auto absolute flex items-center justify-center rounded-lg border text-white shadow-lg backdrop-blur-sm ${slot.transparent === false ? 'bg-slate-950/75' : 'bg-transparent'} ${slot.border === true ? 'border-white/25' : 'border-transparent'}`}
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
                className={`pointer-events-auto absolute flex items-center justify-center overflow-hidden rounded-lg border px-2 text-center text-sm font-semibold text-white shadow-lg backdrop-blur-sm ${slot.transparent === false ? 'bg-slate-950/75' : 'bg-transparent'} ${slot.border === true ? 'border-white/25' : 'border-transparent'}`}
                style={{
                  left: `${slot.x * 100}%`,
                  top: `${slot.y * 100}%`,
                  width: `${slot.width * 100}%`,
                  height: `${slot.height * 100}%`,
                  fontSize: `${((slot.fontSize ?? 32) / 1920) * 100}cqw`,
                }}
              >
                <span className="truncate" style={{ fontSize: '1em' }}>
                  {slot.content}
                </span>
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
          const cycleMetric = () =>
            setSelectedMetrics((current) => ({
              ...current,
              [slot.id]: nextMetric,
            }));
          const clearLongPressTimer = () => {
            if (longPressTimer.current !== null) {
              window.clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          };
          return (
            <button
              key={slot.id}
              type="button"
              className={`pointer-events-auto absolute min-h-0 min-w-0 overflow-hidden cursor-pointer rounded-lg border px-3 py-2 text-left text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${slot.transparent === false ? 'bg-slate-950/75' : 'bg-transparent'} ${slot.border === true ? 'border-white/25' : 'border-transparent'}`}
              style={{
                left: `${slot.x * 100}%`,
                top: `${slot.y * 100}%`,
                width: `${slot.width * 100}%`,
                height: `${slot.height * 100}%`,
                fontSize: `${((slot.fontSize ?? 32) / 1920) * 100}cqw`,
                textAlign: slot.valueAlign ?? 'left',
              }}
              onPointerDown={() => {
                longPressTriggered.current = false;
                clearLongPressTimer();
                longPressTimer.current = window.setTimeout(() => {
                  longPressTriggered.current = true;
                  if (slot.longPressAction === 'cycle_metric') cycleMetric();
                }, 550);
              }}
              onPointerUp={clearLongPressTimer}
              onPointerCancel={clearLongPressTimer}
              onClick={() => {
                clearLongPressTimer();
                if (longPressTriggered.current) {
                  longPressTriggered.current = false;
                  return;
                }
                if (slot.clickAction !== 'none') cycleMetric();
              }}
              aria-label={`${t(`flights.${METRIC_LABELS[metric]}`)} ${formatTelemetryValue(value)}${slot.showUnit === false ? '' : ` ${unit}`}. ${t('flights.telemetryChangeMetric')}`}
            >
              {slot.variant === 'speedometer' ? (
                <TelemetrySpeedometer
                  metric={metric}
                  value={value}
                  unit={unit}
                  showUnit={slot.showUnit !== false}
                />
              ) : (
                slot.showLabel !== false && (
                  <span
                    className="block font-semibold uppercase tracking-wide text-slate-300"
                    style={{ fontSize: '0.35em' }}
                  >
                    {t(`flights.${METRIC_LABELS[metric]}`)}
                  </span>
                )
              )}
              <span
                className="mt-0.5 block font-mono font-bold leading-none"
                style={{ fontSize: '1em' }}
              >
                {formatTelemetryValue(value)}
                {slot.showUnit !== false && (
                  <span
                    className="ml-1 font-normal text-slate-300"
                    style={{ fontSize: '0.45em' }}
                  >
                    {unit}
                  </span>
                )}
              </span>
            </button>
          );
        })}
    </div>
  );
}
