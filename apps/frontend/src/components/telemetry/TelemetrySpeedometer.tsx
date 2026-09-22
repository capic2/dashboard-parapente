import {
  formatTelemetryValue,
  type MetricKey,
} from '../flights/details/telemetryMetrics';
import type { TelemetryWidgetVariant } from '../flights/details/flightTelemetryLayout';

function polarPoint(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: 50 + Math.cos(radians) * radius,
    y: 50 + Math.sin(radians) * radius,
  };
}

function arcPath(startAngle: number, endAngle: number, radius: number) {
  const start = polarPoint(startAngle, radius);
  const end = polarPoint(endAngle, radius);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
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
  showUnit = true,
  variant = 'speedometer',
}: {
  metric: MetricKey;
  value: number | string | null | undefined;
  unit: string;
  showUnit?: boolean;
  variant?: TelemetryWidgetVariant;
}) {
  const maximum = maximumForMetric(metric);
  const numericValue =
    typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const ratio = Math.max(0, Math.min(1, numericValue / maximum));
  const needleAngle = -225 + ratio * 270;
  const needle = polarPoint(needleAngle, 31);
  const valueLabel = formatTelemetryValue(value, '');

  if (variant === 'digital') {
    return (
      <div className="flex h-full w-full min-h-0 min-w-0 flex-col justify-center gap-[8%] rounded-xl border border-cyan-300/50 bg-slate-950/75 px-[10%] text-white shadow-inner">
        <div className="flex items-end justify-between gap-2">
          <span
            className="font-mono font-bold leading-none"
            style={{ fontSize: '34%' }}
          >
            {valueLabel}
          </span>
          {showUnit && (
            <span
              className="font-semibold text-cyan-200"
              style={{ fontSize: '14%' }}
            >
              {unit}
            </span>
          )}
        </div>
        <div className="h-[8%] overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (variant === 'radial') {
    const circumference = 2 * Math.PI * 38;
    return (
      <div className="relative h-full w-full min-h-0 min-w-0 text-white">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <circle cx="50" cy="50" r="43" fill="rgba(2,6,23,.8)" />
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="rgba(255,255,255,.18)"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="#67e8f9"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div
          className="absolute inset-x-0 top-[38%] text-center font-mono font-bold leading-none"
          style={{ fontSize: '22%' }}
        >
          {valueLabel}
        </div>
        {showUnit && (
          <div
            className="absolute inset-x-0 top-[61%] text-center font-semibold text-cyan-200"
            style={{ fontSize: '11%' }}
          >
            {unit}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'arc') {
    const startAngle = -225;
    const endAngle = startAngle + ratio * 270;
    return (
      <div className="relative h-full w-full min-h-0 min-w-0 text-white">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <path
            d={arcPath(startAngle, startAngle + 270, 38)}
            fill="none"
            stroke="rgba(255,255,255,.18)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d={arcPath(startAngle, endAngle, 38)}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {Array.from({ length: 6 }, (_, index) => {
            const point = polarPoint(startAngle + index * 54, 38);
            return (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r="1.4"
                fill="white"
              />
            );
          })}
        </svg>
        <div
          className="absolute inset-x-0 top-[54%] text-center font-mono font-bold leading-none"
          style={{ fontSize: '25%' }}
        >
          {valueLabel}
        </div>
        {showUnit && (
          <div
            className="absolute inset-x-0 top-[76%] text-center font-semibold text-amber-200"
            style={{ fontSize: '11%' }}
          >
            {unit}
          </div>
        )}
      </div>
    );
  }

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
        {valueLabel}
      </div>
      {showUnit && (
        <div
          className="absolute inset-x-0 bottom-[5%] text-center font-semibold"
          style={{ fontSize: '11%' }}
        >
          {unit}
        </div>
      )}
    </div>
  );
}
