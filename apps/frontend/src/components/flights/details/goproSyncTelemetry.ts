import type { GeoPoint } from '../../../types/flight';

export type GoproSyncTelemetry = GeoPoint & { speedKmh: number };

const EARTH_RADIUS_M = 6_371_000;
type TelemetrySample = Pick<GeoPoint, 'lat' | 'lon' | 'timestamp'>;

export function telemetryTimestampAtVideoTime(
  timelineStartTimestamp: number,
  sourceVideoTimeSeconds: number,
  manualOffsetSeconds: number
) {
  return (
    timelineStartTimestamp +
    (sourceVideoTimeSeconds - manualOffsetSeconds) * 1000
  );
}

function distanceMeters(first: TelemetrySample, second: TelemetrySample) {
  const toRadians = Math.PI / 180;
  const latitudeDelta = (second.lat - first.lat) * toRadians;
  const longitudeDelta = (second.lon - first.lon) * toRadians;
  const firstLatitude = first.lat * toRadians;
  const secondLatitude = second.lat * toRadians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(haversine));
}

export function telemetrySpeedKmhBetween(
  first: TelemetrySample,
  second: TelemetrySample
) {
  const durationMs = second.timestamp - first.timestamp;
  return durationMs > 0
    ? (distanceMeters(first, second) / durationMs) * 3_600
    : 0;
}

export function telemetryAtTimestamp(
  coordinates: GeoPoint[],
  timestamp: number
): GoproSyncTelemetry | null {
  if (
    coordinates.length === 0 ||
    timestamp < coordinates[0].timestamp ||
    timestamp > coordinates[coordinates.length - 1].timestamp
  ) {
    return null;
  }

  let low = 0;
  let high = coordinates.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (coordinates[middle].timestamp < timestamp) low = middle + 1;
    else high = middle;
  }

  const next = coordinates[low];
  const previous = coordinates[Math.max(0, low - 1)];
  const durationMs = next.timestamp - previous.timestamp;
  const progress =
    durationMs > 0 ? (timestamp - previous.timestamp) / durationMs : 0;
  const speedKmh = telemetrySpeedKmhBetween(previous, next);
  return {
    lat: previous.lat + (next.lat - previous.lat) * progress,
    lon: previous.lon + (next.lon - previous.lon) * progress,
    elevation:
      previous.elevation + (next.elevation - previous.elevation) * progress,
    timestamp,
    heart_rate: previous.heart_rate ?? next.heart_rate,
    speedKmh,
  };
}
