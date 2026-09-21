import type {
  FlightTelemetryData,
  FlightTelemetryPoint,
} from '../../../hooks/flights/useFlightTelemetry';

function distanceMeters(
  first: FlightTelemetryPoint,
  second: FlightTelemetryPoint
) {
  const radius = 6_371_000;
  const latitudeDelta = ((second.lat - first.lat) * Math.PI) / 180;
  const longitudeDelta = ((second.lon - first.lon) * Math.PI) / 180;
  const latitude = (first.lat * Math.PI) / 180;
  const nextLatitude = (second.lat * Math.PI) / 180;
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude) *
      Math.cos(nextLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function headingDegrees(
  first: FlightTelemetryPoint,
  second: FlightTelemetryPoint
) {
  const latitude = (first.lat * Math.PI) / 180;
  const nextLatitude = (second.lat * Math.PI) / 180;
  const longitudeDelta = ((second.lon - first.lon) * Math.PI) / 180;
  return (
    ((Math.atan2(
      Math.sin(longitudeDelta) * Math.cos(nextLatitude),
      Math.cos(latitude) * Math.sin(nextLatitude) -
        Math.sin(latitude) * Math.cos(nextLatitude) * Math.cos(longitudeDelta)
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}

export async function parseTelemetryGpxFile(
  file: File
): Promise<FlightTelemetryData> {
  const xml = await file.text();
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Invalid GPX XML');
  }
  const trackPoints = Array.from(document.querySelectorAll('trkpt'));
  if (!trackPoints.length) throw new Error('GPX contains no track points');

  let lastTimestamp = 0;
  const points: FlightTelemetryPoint[] = trackPoints.map((trackPoint) => {
    const timestampValue = trackPoint.querySelector('time')?.textContent;
    const parsedTimestamp = timestampValue
      ? Date.parse(timestampValue) / 1000
      : undefined;
    const timestamp =
      parsedTimestamp !== undefined && Number.isFinite(parsedTimestamp)
        ? parsedTimestamp
        : lastTimestamp + 1;
    lastTimestamp = timestamp;
    return {
      timestamp,
      lat: Number(trackPoint.getAttribute('lat') ?? 0),
      lon: Number(trackPoint.getAttribute('lon') ?? 0),
      elevation: Number(trackPoint.querySelector('ele')?.textContent ?? 0),
      segment: 0,
      distance_km: 0,
    };
  });

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const duration = Math.max(point.timestamp - previous.timestamp, 0.001);
    const distance = distanceMeters(previous, point);
    point.distance_km = (previous.distance_km ?? 0) + distance / 1000;
    point.speed_kmh = (distance / duration) * 3.6;
    point.vario_ms = (point.elevation - previous.elevation) / duration;
    point.heading_deg = headingDegrees(previous, point);
  }

  return {
    points,
    source: 'gpx',
    has_osv: false,
    enrichment_status: 'ready',
    start_time: new Date(points[0].timestamp * 1000).toISOString(),
    end_time: new Date(
      points[points.length - 1].timestamp * 1000
    ).toISOString(),
    duration_seconds: Math.max(
      points[points.length - 1].timestamp - points[0].timestamp,
      0
    ),
  };
}
