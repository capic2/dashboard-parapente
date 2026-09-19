const ISO_TZ_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Parses API datetimes that may be serialized without timezone offset.
 * If an ISO datetime string has no timezone suffix, it is treated as UTC.
 */
export function parseApiUtcDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (ISO_TZ_SUFFIX_RE.test(value)) return new Date(value);
  return new Date(`${value}Z`);
}

/** Parse an API date-only value without letting UTC midnight alter its day. */
export function parseApiLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
