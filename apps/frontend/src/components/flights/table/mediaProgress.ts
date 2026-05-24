export function formatMediaProgressLabel(
  label: string,
  progress?: number | null
): string {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) {
    return label;
  }

  const roundedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  return `${label} ${roundedProgress}%`;
}
