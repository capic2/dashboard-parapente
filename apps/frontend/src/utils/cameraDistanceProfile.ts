export const DEFAULT_CAMERA_CLOSE_ZOOM_PERCENT = 75;
export const DEFAULT_CAMERA_TRANSITION_PERCENT = 12;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const smoothstep = (value: number): number => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

export const getFlightCameraDistance = ({
  progress,
  baseDistance,
  closeZoomPercent = DEFAULT_CAMERA_CLOSE_ZOOM_PERCENT,
  transitionPercent = DEFAULT_CAMERA_TRANSITION_PERCENT,
}: {
  progress: number;
  baseDistance: number;
  closeZoomPercent?: number | null;
  transitionPercent?: number | null;
}): number => {
  const safeProgress = clamp(progress, 0, 1);
  const safeBaseDistance = Math.max(0, baseDistance);
  const safeCloseZoomPercent = clamp(
    closeZoomPercent ?? DEFAULT_CAMERA_CLOSE_ZOOM_PERCENT,
    30,
    100
  );
  const safeTransitionPercent = clamp(
    transitionPercent ?? DEFAULT_CAMERA_TRANSITION_PERCENT,
    1,
    40
  );

  const transitionProgress = safeTransitionPercent / 100;
  const distanceFromEdge = Math.min(safeProgress, 1 - safeProgress);
  const normalDistanceWeight = smoothstep(
    distanceFromEdge / transitionProgress
  );
  const closeDistance = safeBaseDistance * (safeCloseZoomPercent / 100);

  return (
    closeDistance + (safeBaseDistance - closeDistance) * normalDistanceWeight
  );
};
