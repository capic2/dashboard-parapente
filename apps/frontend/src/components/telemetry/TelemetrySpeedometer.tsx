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
  const signedRatio = Math.max(
    0,
    Math.min(1, (numericValue + maximum) / (maximum * 2))
  );
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

  if (variant === 'compass') {
    const heading = ((numericValue % 360) + 360) % 360;
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
            fill="rgba(2,6,23,.82)"
            stroke="rgba(255,255,255,.28)"
            strokeWidth="1"
          />
          {Array.from({ length: 24 }, (_, index) => {
            const angle = index * 15 - 90;
            const outer = polarPoint(angle, 39);
            const inner = polarPoint(angle, index % 3 === 0 ? 32 : 35);
            return (
              <line
                key={angle}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(255,255,255,.75)"
                strokeWidth={index % 3 === 0 ? 1.3 : 0.7}
              />
            );
          })}
          <g transform={`rotate(${heading} 50 50)`}>
            <path d="M50 14 L46.5 50 L50 46 L53.5 50 Z" fill="#f43f5e" />
            <path d="M50 86 L46.5 50 L50 54 L53.5 50 Z" fill="#f8fafc" />
          </g>
          <circle cx="50" cy="50" r="3" fill="#f8fafc" />
          <text
            x="50"
            y="25"
            textAnchor="middle"
            fill="#f8fafc"
            fontSize="9"
            fontWeight="700"
          >
            N
          </text>
          <text x="75" y="53" textAnchor="middle" fill="#cbd5e1" fontSize="8">
            E
          </text>
          <text x="50" y="82" textAnchor="middle" fill="#cbd5e1" fontSize="8">
            S
          </text>
          <text x="25" y="53" textAnchor="middle" fill="#cbd5e1" fontSize="8">
            W
          </text>
        </svg>
        <div
          className="absolute inset-x-0 bottom-[7%] text-center font-mono font-bold leading-none"
          style={{ fontSize: '17%' }}
        >
          {valueLabel}°
        </div>
      </div>
    );
  }

  if (variant === 'bar') {
    const barRatio =
      metric === 'vario' || metric === 'vario_min' || metric === 'vario_max'
        ? signedRatio
        : ratio;
    return (
      <div className="flex h-full w-full min-h-0 min-w-0 flex-col justify-center gap-[8%] px-[6%] text-white">
        <div className="flex items-end justify-between gap-2">
          <span
            className="font-mono font-bold leading-none"
            style={{ fontSize: '30%' }}
          >
            {valueLabel}
          </span>
          {showUnit && (
            <span className="text-cyan-200" style={{ fontSize: '14%' }}>
              {unit}
            </span>
          )}
        </div>
        <div className="relative h-[18%] overflow-hidden rounded-full border border-white/30 bg-slate-950/70">
          {metric === 'vario' ||
          metric === 'vario_min' ||
          metric === 'vario_max' ? (
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/70" />
          ) : null}
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-300 to-amber-300"
            style={{ width: `${barRatio * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (variant === 'chart') {
    const points = [0.34, 0.48, 0.4, 0.62, 0.55, 0.72, 0.66, 0.82, 0.76, ratio];
    const path = points
      .map(
        (point, index) =>
          `${index ? 'L' : 'M'} ${index * (100 / (points.length - 1))} ${92 - point * 70}`
      )
      .join(' ');
    return (
      <div className="relative h-full w-full min-h-0 min-w-0 text-white">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            x="2"
            y="8"
            width="96"
            height="84"
            rx="6"
            fill="rgba(2,6,23,.78)"
            stroke="rgba(255,255,255,.22)"
          />
          <path
            d="M 4 76 H 96 M 4 54 H 96 M 4 32 H 96"
            stroke="rgba(255,255,255,.12)"
            strokeDasharray="2 3"
          />
          <path
            d={path}
            fill="none"
            stroke="#67e8f9"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="100" cy={92 - ratio * 70} r="3" fill="#f8fafc" />
        </svg>
        <div
          className="absolute inset-x-0 bottom-[10%] text-center font-mono font-bold leading-none"
          style={{ fontSize: '18%' }}
        >
          {valueLabel}
          {showUnit ? ` ${unit}` : ''}
        </div>
      </div>
    );
  }

  if (variant === 'asi') {
    const startAngle = -225;
    const segments = [
      { end: 0.35, color: '#22c55e' },
      { end: 0.7, color: '#facc15' },
      { end: 1, color: '#ef4444' },
    ];
    return (
      <div className="relative h-full w-full min-h-0 min-w-0 text-white">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <circle cx="50" cy="50" r="44" fill="rgba(2,6,23,.82)" />
          {segments.map((segment, index) => {
            const previous = index ? segments[index - 1].end : 0;
            return (
              <path
                key={segment.end}
                d={arcPath(
                  startAngle + previous * 270,
                  startAngle + segment.end * 270,
                  38
                )}
                fill="none"
                stroke={segment.color}
                strokeWidth="7"
                strokeLinecap="butt"
              />
            );
          })}
          {Array.from({ length: 11 }, (_, index) => {
            const angle = startAngle + index * 27;
            const outer = polarPoint(angle, 40);
            const inner = polarPoint(angle, index % 2 === 0 ? 33 : 36);
            return (
              <line
                key={angle}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="white"
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
            className="absolute inset-x-0 bottom-[5%] text-center"
            style={{ fontSize: '11%' }}
          >
            {unit}
          </div>
        )}
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
