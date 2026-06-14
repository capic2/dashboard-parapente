import type { Site } from '../../types';

interface FormatFlightSiteLabelOptions {
  siteId: string | null | undefined;
  siteName: string | null | undefined;
  sites: Site[];
  fallback?: string;
}

export function formatFlightSiteLabel({
  siteId,
  siteName,
  sites,
  fallback,
}: FormatFlightSiteLabelOptions): string {
  const site =
    sites.find((candidate) => siteId != null && candidate.id === siteId) ??
    sites.find((candidate) => siteName != null && candidate.name === siteName);
  const displayedName = site?.name ?? siteName ?? siteId ?? fallback;
  if (!displayedName) return '';

  const region = site?.region?.trim();

  if (!region || region === displayedName) return displayedName;

  return `${region} - ${displayedName}`;
}
