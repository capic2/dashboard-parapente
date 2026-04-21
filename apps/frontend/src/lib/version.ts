function parseVersion(version: string): number[] | null {
  const trimmed = version.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split('.');
  const parsed = parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      return Number.NaN;
    }
    return Number.parseInt(part, 10);
  });

  if (parsed.some((part) => Number.isNaN(part))) {
    return null;
  }

  return parsed;
}

export function compareVersions(left: string, right: string): number {
  const leftParsed = parseVersion(left);
  const rightParsed = parseVersion(right);

  if (!leftParsed || !rightParsed) {
    return 0;
  }

  const maxLength = Math.max(leftParsed.length, rightParsed.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParsed[index] ?? 0;
    const rightValue = rightParsed[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

export function isVersionNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) === 1;
}
