const isStaging = import.meta.env.BASE_URL.startsWith('/staging');

export const appTitle = isStaging
  ? '[staging] Dashboard Parapente'
  : 'Dashboard Parapente';

export function getStagingPrNumber(version: string | null): string | null {
  if (!isStaging || !version) return null;

  return /^0\.0\.0\.(\d+)$/u.exec(version)?.[1] ?? null;
}
