export interface ExportFrameTarget {
  progress: number;
  previousIndex: number;
  nextIndex: number;
  ratio: number;
}

export function getExportFrameTargetIndex(
  frameIndex: number,
  totalFrames: number,
  totalPositions: number
): number {
  const target = getExportFrameTarget(frameIndex, totalFrames, totalPositions);
  return target.ratio >= 0.5 ? target.nextIndex : target.previousIndex;
}

export function getExportFrameTarget(
  frameIndex: number,
  totalFrames: number,
  totalPositions: number
): ExportFrameTarget {
  const lastPositionIndex = Math.max(totalPositions - 1, 0);
  const lastFrameIndex = Math.max(totalFrames - 1, 1);
  const progress = Math.min(Math.max(frameIndex / lastFrameIndex, 0), 1);
  const exactIndex = progress * lastPositionIndex;
  const previousIndex = Math.floor(exactIndex);
  const nextIndex = Math.ceil(exactIndex);

  return {
    progress,
    previousIndex,
    nextIndex,
    ratio: exactIndex - previousIndex,
  };
}
