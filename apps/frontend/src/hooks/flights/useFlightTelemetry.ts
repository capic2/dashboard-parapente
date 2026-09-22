import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { telemetryTimestampAtVideoTime } from '../../components/flights/details/goproSyncTelemetry';

export interface FlightTelemetryPoint {
  timestamp: number;
  lat: number;
  lon: number;
  elevation: number;
  segment: number;
  speed_kmh?: number | null;
  vario_ms?: number | null;
  heading_deg?: number | null;
  distance_km?: number | null;
  altitude_relative_m?: number | null;
  heart_rate?: number | null;
  power?: number | null;
}

export interface FlightTelemetryData {
  points: FlightTelemetryPoint[];
  source: 'gpx' | 'gpx+osv';
  has_osv: boolean;
  enrichment_status: 'missing' | 'ready' | 'pending';
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number;
}

export function useFlightTelemetry(flightId: string, enabled = true) {
  return useQuery<FlightTelemetryData>({
    queryKey: ['flights', flightId, 'telemetry'],
    queryFn: () => api.get(`flights/${flightId}/telemetry`).json(),
    enabled: Boolean(flightId) && enabled,
    staleTime: 1000 * 60 * 60,
    refetchInterval: (query) =>
      query.state.data?.enrichment_status === 'pending' ? 2000 : false,
  });
}

function interpolateOptional(
  first: number | null | undefined,
  second: number | null | undefined,
  ratio: number
) {
  if (first == null && second == null) return null;
  if (first == null) return second ?? null;
  if (second == null) return first;
  return first + (second - first) * ratio;
}

function interpolateHeading(
  first: number | null | undefined,
  second: number | null | undefined,
  ratio: number
) {
  if (first == null || second == null) {
    return interpolateOptional(first, second, ratio);
  }
  const delta = ((second - first + 540) % 360) - 180;
  return (first + delta * ratio + 360) % 360;
}

export function interpolateTelemetryAtVideoTime(
  data: FlightTelemetryData | undefined,
  videoTimeSeconds: number,
  offsetSeconds: number,
  timelineStartTimestamp?: number
): FlightTelemetryPoint | null {
  const points = data?.points;
  if (
    !points?.length ||
    !Number.isFinite(videoTimeSeconds) ||
    !Number.isFinite(offsetSeconds)
  ) {
    return null;
  }

  const firstTimestamp = points[0].timestamp;
  const targetTimestamp = telemetryTimestampAtVideoTime(
    timelineStartTimestamp !== undefined &&
      Number.isFinite(timelineStartTimestamp)
      ? timelineStartTimestamp
      : firstTimestamp,
    videoTimeSeconds,
    offsetSeconds
  );
  if (
    targetTimestamp < points[0].timestamp ||
    targetTimestamp > points[points.length - 1].timestamp
  ) {
    return null;
  }

  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].timestamp < targetTimestamp) low = middle + 1;
    else high = middle;
  }

  const next = points[low];
  const previous = points[Math.max(0, low - 1)];
  if (!previous || !next || previous === next) {
    return next ?? null;
  }
  if (previous.segment !== next.segment) {
    return targetTimestamp === next.timestamp ? next : null;
  }

  const duration = next.timestamp - previous.timestamp;
  const ratio =
    duration > 0 ? (targetTimestamp - previous.timestamp) / duration : 0;
  return {
    timestamp: targetTimestamp,
    lat: previous.lat + (next.lat - previous.lat) * ratio,
    lon: previous.lon + (next.lon - previous.lon) * ratio,
    elevation:
      previous.elevation + (next.elevation - previous.elevation) * ratio,
    segment: previous.segment,
    speed_kmh: interpolateOptional(previous.speed_kmh, next.speed_kmh, ratio),
    vario_ms: interpolateOptional(previous.vario_ms, next.vario_ms, ratio),
    heading_deg: interpolateHeading(
      previous.heading_deg,
      next.heading_deg,
      ratio
    ),
    distance_km: interpolateOptional(
      previous.distance_km,
      next.distance_km,
      ratio
    ),
    altitude_relative_m: interpolateOptional(
      previous.altitude_relative_m,
      next.altitude_relative_m,
      ratio
    ),
    heart_rate: interpolateOptional(
      previous.heart_rate,
      next.heart_rate,
      ratio
    ),
    power: interpolateOptional(previous.power, next.power, ratio),
  };
}
