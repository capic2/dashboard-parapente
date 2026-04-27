export interface ViewerUnits {
  altitude: 'm' | 'ft';
  speed: 'kmh' | 'mph';
}

export interface TelemetryPoint {
  lat: number;
  lon: number;
  elevation: number;
  timestamp: number;
}

export const DEFAULT_VIEWER_UNITS: ViewerUnits = {
  altitude: 'm',
  speed: 'kmh',
};

const EARTH_RADIUS_METERS = 6371000;
const FEET_PER_METER = 3.28084;
const MPH_PER_KMH = 0.621371;

const toRadians = (value: number): number => (value * Math.PI) / 180;

const distanceMetersBetween = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};

export const formatTelemetryNumber = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const parseViewerUnits = (raw: string | null): ViewerUnits => {
  if (!raw) {
    return DEFAULT_VIEWER_UNITS;
  }

  try {
    const parsed = JSON.parse(raw) as {
      units?: { altitude?: string; speed?: string };
    };

    const altitude = parsed.units?.altitude === 'ft' ? 'ft' : 'm';
    const speed = parsed.units?.speed === 'mph' ? 'mph' : 'kmh';
    return { altitude, speed };
  } catch {
    return DEFAULT_VIEWER_UNITS;
  }
};

export const getViewerUnitsFromStorage = (
  storage?: Pick<Storage, 'getItem'> | null
): ViewerUnits => {
  if (!storage) {
    return DEFAULT_VIEWER_UNITS;
  }

  return parseViewerUnits(storage.getItem('paragliding-settings'));
};

export const computeCursorTelemetryLabel = (
  index: number,
  coordinates: readonly TelemetryPoint[] | undefined,
  elevationOffset: number,
  units: ViewerUnits
): string => {
  const speedUnit = units.speed === 'mph' ? 'mph' : 'km/h';
  const altitudeUnit = units.altitude;

  if (!coordinates?.length || index < 0) {
    return `0 ${altitudeUnit}\n0 ${speedUnit}`;
  }

  const safeIndex = Math.min(index, coordinates.length - 1);
  const current = coordinates[safeIndex];
  if (!current) {
    return `0 ${altitudeUnit}\n0 ${speedUnit}`;
  }

  const altitudeMeters = current.elevation + elevationOffset;

  let speedKmh = 0;
  if (safeIndex > 0) {
    const previous = coordinates[safeIndex - 1];
    const dtMilliseconds = current.timestamp - previous.timestamp;

    if (dtMilliseconds > 0) {
      const distanceMeters = distanceMetersBetween(
        previous.lat,
        previous.lon,
        current.lat,
        current.lon
      );
      speedKmh = (distanceMeters / dtMilliseconds) * 3600;
    }
  }

  const altitudeValue =
    units.altitude === 'ft' ? altitudeMeters * FEET_PER_METER : altitudeMeters;
  const speedValue = units.speed === 'mph' ? speedKmh * MPH_PER_KMH : speedKmh;

  const altitudeText = `${formatTelemetryNumber(altitudeValue)} ${altitudeUnit}`;
  const speedText = `${formatTelemetryNumber(speedValue)} ${speedUnit}`;
  return `${altitudeText}\n${speedText}`;
};
