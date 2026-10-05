interface FlightPoint {
  elevation?: number | null;
  lat?: number | null;
  lon?: number | null;
}

const MIN_TURN_ANGLE_RADIANS = Math.PI / 3;

const getBearing = (
  start: FlightPoint,
  end: FlightPoint
): number | undefined => {
  if (
    typeof start.lat !== 'number' ||
    typeof start.lon !== 'number' ||
    typeof end.lat !== 'number' ||
    typeof end.lon !== 'number' ||
    !Number.isFinite(start.lat) ||
    !Number.isFinite(start.lon) ||
    !Number.isFinite(end.lat) ||
    !Number.isFinite(end.lon)
  ) {
    return undefined;
  }
  if (start.lat === end.lat && start.lon === end.lon) {
    return undefined;
  }

  const startLatitude = (start.lat * Math.PI) / 180;
  const endLatitude = (end.lat * Math.PI) / 180;
  const longitudeDifference = ((end.lon - start.lon) * Math.PI) / 180;

  return Math.atan2(
    Math.sin(longitudeDifference) * Math.cos(endLatitude),
    Math.cos(startLatitude) * Math.sin(endLatitude) -
      Math.sin(startLatitude) *
        Math.cos(endLatitude) *
        Math.cos(longitudeDifference)
  );
};

const getTurnAngle = (firstBearing: number, secondBearing: number) => {
  const difference = Math.abs(secondBearing - firstBearing);
  return difference > Math.PI ? Math.PI * 2 - difference : difference;
};

/**
 * Finds the highest valid GPS elevation when it is away from takeoff and
 * landing. It gives the first automatic highlight a meaningful, stable point
 * without attempting to infer a thermal from sparse GPS data.
 */
export const getHighestAltitudeHighlightProgress = (
  coordinates: readonly FlightPoint[]
): number | undefined => {
  if (coordinates.length < 3) return undefined;

  let highestIndex = -1;
  let highestElevation = Number.NEGATIVE_INFINITY;
  for (const [index, coordinate] of coordinates.entries()) {
    const elevation = coordinate.elevation;
    if (typeof elevation === 'number' && Number.isFinite(elevation)) {
      if (elevation > highestElevation) {
        highestElevation = elevation;
        highestIndex = index;
      }
    }
  }

  if (highestIndex === -1) return undefined;

  const progress = highestIndex / (coordinates.length - 1);
  return progress > 0.2 && progress < 0.8 ? progress : undefined;
};

/**
 * Finds the strongest interior course change. This is deliberately a
 * conservative visual cue: a single sharp turn is enough for a camera plan,
 * while thermal classification remains a separate future concern.
 */
export const getStrongestTurnHighlightProgress = (
  coordinates: readonly FlightPoint[]
): number | undefined => {
  if (coordinates.length < 3) return undefined;

  let strongestTurn = MIN_TURN_ANGLE_RADIANS;
  let strongestTurnIndex = -1;

  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const progress = index / (coordinates.length - 1);
    if (progress <= 0.2 || progress >= 0.8) continue;

    const incomingBearing = getBearing(
      coordinates[index - 1],
      coordinates[index]
    );
    const outgoingBearing = getBearing(
      coordinates[index],
      coordinates[index + 1]
    );
    if (incomingBearing === undefined || outgoingBearing === undefined) {
      continue;
    }

    const turnAngle = getTurnAngle(incomingBearing, outgoingBearing);
    if (turnAngle > strongestTurn) {
      strongestTurn = turnAngle;
      strongestTurnIndex = index;
    }
  }

  return strongestTurnIndex === -1
    ? undefined
    : strongestTurnIndex / (coordinates.length - 1);
};

export interface ThermalWindow {
  startProgress: number;
  endProgress: number;
  direction: 1 | -1;
}

/** Finds three consecutive interior turns in the same direction. */
export const getThermalWindow = (
  coordinates: readonly FlightPoint[]
): ThermalWindow | undefined => {
  const turns: { index: number; direction: 1 | -1 }[] = [];
  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const incoming = getBearing(coordinates[index - 1], coordinates[index]);
    const outgoing = getBearing(coordinates[index], coordinates[index + 1]);
    if (incoming === undefined || outgoing === undefined) continue;
    const signed = Math.atan2(
      Math.sin(outgoing - incoming),
      Math.cos(outgoing - incoming)
    );
    if (Math.abs(signed) >= MIN_TURN_ANGLE_RADIANS) {
      turns.push({ index, direction: signed > 0 ? 1 : -1 });
    }
  }
  for (let index = 0; index <= turns.length - 3; index += 1) {
    const sequence = turns.slice(index, index + 3);
    if (sequence.every((turn) => turn.direction === sequence[0].direction)) {
      const startProgress = sequence[0].index / (coordinates.length - 1);
      const endProgress = sequence[2].index / (coordinates.length - 1);
      if (startProgress > 0.2 && endProgress < 0.8) {
        return { startProgress, endProgress, direction: sequence[0].direction };
      }
    }
  }
  return undefined;
};
