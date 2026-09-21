import {
  formatTelemetryValue,
  type MetricKey,
} from '../flights/details/telemetryMetrics';

function polarPoint(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: 50 + Math.cos(radians) * radius,
    y: 50 + Math.sin(radians) * radius,
  };
}

function maximumForMetric(metric: MetricKey) {
  if (metric === 'speed') return 100;
  if (metric === 'vario' || metric === 'vario_min' || metric === 'vario_max')
    return 10;
  if (
    metric === 'heart_rate' ||
    metric === 'heart_rate_min' ||
    metric === 'heart_rate_max'
  )
    return 200;
  return 100;
}

export function TelemetrySpeedometer({
  metric,
  value,
  unit,
}: {
  metric: MetricKey;
  value: number | string | null | undefined;
  unit: string;
}) {
  const maximum = maximumForMetric(metric);
  const numericValue =
    typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const clampedValue = Math.max(0, Math.min(maximum, numericValue));
  const needleAngle = -225 + (clampedValue / maximum) * 270;
  const needle = polarPoint(needleAngle, 31);

  return (
    <div className="relative h-full w-full min-h-0 min-w-0 text-white">
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="rgba(2, 6, 23, .8)"
          stroke="rgba(255,255,255,.22)"
          strokeWidth="1"
        />
        {Array.from({ length: 11 }, (_, index) => {
          const angle = -225 + index * 27;
          const outer = polarPoint(angle, 40);
          const inner = polarPoint(angle, index % 2 === 0 ? 34 : 37);
          return (
            <line
              key={angle}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(255,255,255,.75)"
              strokeWidth={index % 2 === 0 ? 1 : 0.6}
            />
          );
        })}
        <line
          x1="50"
          y1="50"
          x2={needle.x}
          y2={needle.y}
          stroke="#f8fafc"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="3" fill="#f8fafc" />
      </svg>
      <div
        className="absolute inset-x-0 bottom-[14%] text-center font-mono font-bold leading-none"
        style={{ fontSize: '22%' }}
      >
        {formatTelemetryValue(value, '')}
      </div>
      <div
        className="absolute inset-x-0 bottom-[5%] text-center font-semibold"
        style={{ fontSize: '11%' }}
      >
        {unit}
      </div>
    </div>
  );
}
