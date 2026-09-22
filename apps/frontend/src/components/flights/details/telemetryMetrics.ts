import type {
  FlightTelemetryData,
  FlightTelemetryPoint,
} from '../../../hooks/flights/useFlightTelemetry';

export type MetricKey =
  | 'altitude'
  | 'altitude_min'
  | 'altitude_max'
  | 'start_altitude'
  | 'speed'
  | 'vario'
  | 'vario_min'
  | 'vario_max'
  | 'distance'
  | 'heading'
  | 'heart_rate'
  | 'heart_rate_min'
  | 'heart_rate_max'
  | 'power'
  | 'total_gain'
  | 'total_loss'
  | 'datetime';

export const METRIC_KEYS: MetricKey[] = [
  'altitude',
  'altitude_min',
  'altitude_max',
  'start_altitude',
  'speed',
  'vario',
  'vario_min',
  'vario_max',
  'distance',
  'heading',
  'heart_rate',
  'heart_rate_min',
  'heart_rate_max',
  'power',
  'total_gain',
  'total_loss',
  'datetime',
];

export const METRIC_LABELS: Record<MetricKey, string> = {
  altitude: 'telemetryAltitude',
  altitude_min: 'telemetryAltitudeMin',
  altitude_max: 'telemetryAltitudeMax',
  start_altitude: 'telemetryStartAltitude',
  speed: 'telemetrySpeed',
  vario: 'telemetryVario',
  vario_min: 'telemetryVarioMin',
  vario_max: 'telemetryVarioMax',
  distance: 'telemetryDistance',
  heading: 'telemetryHeading',
  heart_rate: 'telemetryHeartRate',
  heart_rate_min: 'telemetryHeartRateMin',
  heart_rate_max: 'telemetryHeartRateMax',
  power: 'telemetryPower',
  total_gain: 'telemetryTotalGain',
  total_loss: 'telemetryTotalLoss',
  datetime: 'telemetryDateTime',
};

type DisplayValue = number | string | null | undefined;

function numericValues(
  data: FlightTelemetryData | undefined,
  read: (point: FlightTelemetryPoint) => number | null | undefined
) {
  return (data?.points ?? [])
    .map(read)
    .filter(
      (value): value is number => value != null && Number.isFinite(value)
    );
}

function elevationChange(
  data: FlightTelemetryData | undefined,
  positive: boolean
) {
  let total = 0;
  const points = data?.points ?? [];
  for (let index = 1; index < points.length; index += 1) {
    const delta = points[index].elevation - points[index - 1].elevation;
    if (positive ? delta > 0 : delta < 0) total += Math.abs(delta);
  }
  return total;
}

export function getTelemetryMetricValue(
  point: FlightTelemetryPoint | null,
  data: FlightTelemetryData | undefined,
  metric: MetricKey
): [DisplayValue, string] | null {
  if (!point && metric !== 'altitude_min' && metric !== 'altitude_max') {
    return null;
  }
  const altitudes = numericValues(data, (item) => item.elevation);
  const heartRates = numericValues(data, (item) => item.heart_rate);
  const varioValues = numericValues(data, (item) => item.vario_ms);
  switch (metric) {
    case 'altitude':
      return [point?.elevation, 'm'];
    case 'altitude_min':
      return [Math.min(...altitudes), 'm'];
    case 'altitude_max':
      return [Math.max(...altitudes), 'm'];
    case 'start_altitude':
      return [data?.points[0]?.elevation, 'm'];
    case 'speed':
      return [point?.speed_kmh, 'km/h'];
    case 'vario':
      return [point?.vario_ms, 'm/s'];
    case 'vario_min':
      return [Math.min(...varioValues), 'm/s'];
    case 'vario_max':
      return [Math.max(...varioValues), 'm/s'];
    case 'distance':
      return [point?.distance_km, 'km'];
    case 'heading':
      return [point?.heading_deg, '°'];
    case 'heart_rate':
      return [point?.heart_rate, 'bpm'];
    case 'heart_rate_min':
      return [Math.min(...heartRates), 'bpm'];
    case 'heart_rate_max':
      return [Math.max(...heartRates), 'bpm'];
    case 'power':
      return [point?.power, 'W'];
    case 'total_gain':
      return [elevationChange(data, true), 'm'];
    case 'total_loss':
      return [elevationChange(data, false), 'm'];
    case 'datetime': {
      if (!point) return null;
      const timestamp =
        point.timestamp < 1_000_000_000_000
          ? point.timestamp * 1000
          : point.timestamp;
      return [new Date(timestamp).toLocaleString(), ''];
    }
  }
}

export function formatTelemetryValue(value: DisplayValue, emptyValue = '—') {
  if (typeof value === 'string') return value;
  if (value == null || !Number.isFinite(value)) return emptyValue;
  return Math.abs(value) >= 100
    ? Math.round(value).toString()
    : value.toFixed(1);
}
