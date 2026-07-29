export type TrackPoint = {
  lat: number;
  lon: number;
  elevation: number;
};

const ENDPOINT_SAMPLE_SIZE = 5;
const ENDPOINT_OUTLIER_THRESHOLD_METERS = 30;

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

export const getReliableEndpointElevation = (
  points: TrackPoint[],
  endpoint: 'takeoff' | 'landing'
) => {
  if (points.length === 0) return 0;

  const endpointIndex = endpoint === 'takeoff' ? 0 : points.length - 1;
  const endpointElevation = points[endpointIndex].elevation;
  const nearbyPoints =
    endpoint === 'takeoff'
      ? points.slice(1, ENDPOINT_SAMPLE_SIZE + 1)
      : points.slice(Math.max(0, points.length - ENDPOINT_SAMPLE_SIZE - 1), -1);
  const nearbyElevations = nearbyPoints
    .map((point) => point.elevation)
    .filter(Number.isFinite);

  if (nearbyElevations.length < 2) {
    return Number.isFinite(endpointElevation) ? endpointElevation : 0;
  }

  const nearbyMedian = median(nearbyElevations);
  return !Number.isFinite(endpointElevation) ||
    Math.abs(endpointElevation - nearbyMedian) >
      ENDPOINT_OUTLIER_THRESHOLD_METERS
    ? nearbyMedian
    : endpointElevation;
};

export const repairTrackEndpointElevations = <Point extends TrackPoint>(
  points: Point[]
) => {
  if (points.length === 0) return points;

  const repaired = [...points];
  const takeoffElevation = getReliableEndpointElevation(points, 'takeoff');
  const landingElevation = getReliableEndpointElevation(points, 'landing');
  if (takeoffElevation !== points[0].elevation) {
    repaired[0] = { ...points[0], elevation: takeoffElevation };
  }
  const lastIndex = points.length - 1;
  if (landingElevation !== points[lastIndex].elevation) {
    repaired[lastIndex] = { ...points[lastIndex], elevation: landingElevation };
  }
  return repaired;
};

export const getTerrainElevationOffset = (
  terrainElevation: number,
  points: TrackPoint[],
  endpoint: 'takeoff' | 'landing'
) => terrainElevation - getReliableEndpointElevation(points, endpoint);

export const getInterpolatedElevationOffset = (
  pointIndex: number,
  totalPoints: number,
  takeoffOffset: number,
  landingOffset: number | null | undefined
) => {
  if (
    landingOffset === null ||
    landingOffset === undefined ||
    totalPoints <= 1
  ) {
    return takeoffOffset;
  }

  const progress = Math.min(Math.max(pointIndex / (totalPoints - 1), 0), 1);
  return takeoffOffset + (landingOffset - takeoffOffset) * progress;
};

export const getRenderedTrackElevation = (
  point: TrackPoint,
  pointIndex: number,
  totalPoints: number,
  takeoffOffset: number,
  landingOffset: number | null | undefined
) =>
  point.elevation +
  getInterpolatedElevationOffset(
    pointIndex,
    totalPoints,
    takeoffOffset,
    landingOffset
  );

export const getBearingRadians = (from: TrackPoint, to: TrackPoint) => {
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLon = ((to.lon - from.lon) * Math.PI) / 180;

  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);

  return Math.atan2(y, x);
};
