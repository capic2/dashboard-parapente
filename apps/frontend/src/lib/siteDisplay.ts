type SiteDisplayFields = {
  name: string;
  region?: string | null;
};

function normalizeForDisplayMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function siteNameContainsLocality(site: SiteDisplayFields): boolean {
  const locality = normalizeForDisplayMatch(site.region ?? '');
  if (!locality) return false;

  const name = normalizeForDisplayMatch(site.name);
  return ` ${name} `.includes(` ${locality} `);
}

export function getSiteDisplayName(site: SiteDisplayFields): string {
  const locality = site.region?.trim();
  if (!locality || siteNameContainsLocality(site)) return site.name;

  return `${locality} - ${site.name}`;
}

export function isSiteLocalityDisplayed(site: SiteDisplayFields): boolean {
  return Boolean(site.region?.trim());
}
