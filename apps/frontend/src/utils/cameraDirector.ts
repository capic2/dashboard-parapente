export type CameraShotType = 'takeoff' | 'follow' | 'highlight' | 'landing';

export interface CameraShot {
  type: CameraShotType;
  distance: number;
  pitch: number;
}

interface CameraKeyframe {
  progress: number;
  distanceMultiplier: number;
  pitch: number;
}

const CAMERA_KEYFRAMES: readonly CameraKeyframe[] = [
  { progress: 0, distanceMultiplier: 0.65, pitch: -0.22 },
  { progress: 0.15, distanceMultiplier: 0.65, pitch: -0.22 },
  { progress: 0.25, distanceMultiplier: 1, pitch: -0.05 },
  { progress: 0.75, distanceMultiplier: 1, pitch: -0.05 },
  { progress: 0.85, distanceMultiplier: 0.65, pitch: -0.22 },
  { progress: 1, distanceMultiplier: 0.65, pitch: -0.22 },
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const smoothstep = (value: number) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

const getShotType = (progress: number): CameraShotType => {
  if (progress < 0.2) return 'takeoff';
  if (progress > 0.8) return 'landing';
  return 'follow';
};

const getHighlightWeight = (
  progress: number,
  highlightProgress: number | undefined
) => {
  if (
    progress <= 0.2 ||
    progress >= 0.8 ||
    !Number.isFinite(highlightProgress) ||
    highlightProgress === undefined ||
    highlightProgress <= 0.2 ||
    highlightProgress >= 0.8
  ) {
    return 0;
  }

  const distance = Math.abs(progress - highlightProgress);
  const radius = 0.07;
  return distance >= radius ? 0 : 1 - smoothstep(distance / radius);
};

/**
 * Returns the deterministic camera plan used by both interactive replay and
 * frame-by-frame export. Keyframes make the transitions smooth without
 * relying on elapsed browser time.
 */
export const getFlightCameraShot = ({
  progress,
  baseDistance,
  closeZoomPercent = 60,
  transitionPercent = 12,
  highlightProgress,
}: {
  progress: number;
  baseDistance: number;
  closeZoomPercent?: number;
  transitionPercent?: number;
  highlightProgress?: number;
}): CameraShot => {
  const safeProgress = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  const safeBaseDistance = Math.max(
    0,
    Number.isFinite(baseDistance) ? baseDistance : 0
  );
  const safeCloseZoomPercent = clamp(
    Number.isFinite(closeZoomPercent) ? closeZoomPercent : 60,
    30,
    100
  );
  const safeTransitionPercent = clamp(
    Number.isFinite(transitionPercent) ? transitionPercent : 12,
    1,
    25
  );
  const closeDistanceMultiplier = safeCloseZoomPercent / 100;
  const transitionProgress = safeTransitionPercent / 100;
  const keyframes = CAMERA_KEYFRAMES.map((keyframe) => ({
    ...keyframe,
    progress:
      keyframe.progress === 0.15
        ? transitionProgress
        : keyframe.progress === 0.25
          ? transitionProgress * 2
          : keyframe.progress === 0.75
            ? 1 - transitionProgress * 2
            : keyframe.progress === 0.85
              ? 1 - transitionProgress
              : keyframe.progress,
    distanceMultiplier:
      keyframe.distanceMultiplier === 0.65
        ? closeDistanceMultiplier
        : keyframe.distanceMultiplier,
  }));
  const nextKeyframeIndex = keyframes.findIndex(
    (keyframe) => keyframe.progress >= safeProgress
  );
  const resolvedNextKeyframeIndex =
    nextKeyframeIndex === -1 ? keyframes.length - 1 : nextKeyframeIndex;
  const nextKeyframe = keyframes[resolvedNextKeyframeIndex];
  const previousKeyframe =
    keyframes[Math.max(0, resolvedNextKeyframeIndex - 1)];
  const segmentLength = nextKeyframe.progress - previousKeyframe.progress;
  const segmentProgress =
    segmentLength > 0
      ? smoothstep((safeProgress - previousKeyframe.progress) / segmentLength)
      : 0;

  const baseShot = {
    type: getShotType(safeProgress),
    distance:
      safeBaseDistance *
      (previousKeyframe.distanceMultiplier +
        (nextKeyframe.distanceMultiplier -
          previousKeyframe.distanceMultiplier) *
          segmentProgress),
    pitch:
      previousKeyframe.pitch +
      (nextKeyframe.pitch - previousKeyframe.pitch) * segmentProgress,
  };
  const highlightWeight = getHighlightWeight(safeProgress, highlightProgress);

  if (highlightWeight === 0) return baseShot;

  return {
    type: 'highlight',
    distance:
      baseShot.distance +
      (safeBaseDistance * 0.5 - baseShot.distance) * highlightWeight,
    pitch: baseShot.pitch + (-0.16 - baseShot.pitch) * highlightWeight,
  };
};
