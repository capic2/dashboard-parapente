export const REPLAY_TRACK_TRAIL_POINT_COUNT = 80;

export const getReplayTrackTrailPositions = <T>(
  positions: T[],
  previousIndex: number,
  currentPosition: T | undefined,
  maxPointCount = REPLAY_TRACK_TRAIL_POINT_COUNT
) => {
  if (positions.length === 0 || maxPointCount <= 0) return [];

  const safePreviousIndex = Math.min(
    Math.max(previousIndex, 0),
    positions.length - 1
  );
  const hasCurrentPosition = currentPosition !== undefined;
  const historicalPointCount = hasCurrentPosition
    ? Math.max(maxPointCount - 1, 0)
    : maxPointCount;
  const startIndex = Math.max(0, safePreviousIndex - historicalPointCount + 1);
  const trailPositions = positions.slice(startIndex, safePreviousIndex + 1);

  return hasCurrentPosition
    ? [...trailPositions, currentPosition]
    : trailPositions;
};
