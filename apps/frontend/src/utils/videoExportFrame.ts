export function getExportFrameTargetIndex(
  frameIndex: number,
  totalFrames: number,
  totalPositions: number
): number {
  const lastPositionIndex = Math.max(totalPositions - 1, 0);
  if (lastPositionIndex === 0) {
    return 0;
  }

  const lastFrameIndex = Math.max(totalFrames - 1, 1);
  const progress = Math.min(Math.max(frameIndex / lastFrameIndex, 0), 1);

  return Math.round(progress * lastPositionIndex);
}
