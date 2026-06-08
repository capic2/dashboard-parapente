export type TrackPoint = {
  lat: number;
  lon: number;
  elevation: number;
};

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
