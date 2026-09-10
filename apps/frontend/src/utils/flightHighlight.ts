interface FlightPoint {
  elevation?: number | null;
}

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
