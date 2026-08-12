import type { GeoPoint } from '../../../types/flight';

export type GoproSyncTelemetry = GeoPoint & { speedKmh: number };

const EARTH_RADIUS_M = 6_371_000;

function distanceMeters(first: GeoPoint, second: GeoPoint) {
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
  const speedKmh =
    durationMs > 0 ? (distanceMeters(previous, next) / durationMs) * 3_600 : 0;
  return {
    lat: previous.lat + (next.lat - previous.lat) * progress,
    lon: previous.lon + (next.lon - previous.lon) * progress,
    elevation:
      previous.elevation + (next.elevation - previous.elevation) * progress,
    timestamp,
    speedKmh,
  };
}
