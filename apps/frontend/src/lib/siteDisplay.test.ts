import { describe, expect, it } from 'vitest';
import { getSiteDisplayName, isSiteLocalityDisplayed } from './siteDisplay';

describe('getSiteDisplayName', () => {
  it('prefixes the site name with its locality', () => {
    expect(getSiteDisplayName({ name: 'Arguel', region: 'Besançon' })).toBe(
      'Besançon - Arguel'
    );
  });

  it('keeps the site name when there is no locality', () => {
    expect(getSiteDisplayName({ name: 'Arguel', region: null })).toBe('Arguel');
  });

  it('does not duplicate a locality already present in the site name', () => {
    expect(
      getSiteDisplayName({ name: 'Annecy - Planfait', region: 'Annecy' })
    ).toBe('Annecy - Planfait');
  });

  it('matches locality with accents, casing, and simple punctuation normalized', () => {
    expect(
      getSiteDisplayName({
        name: 'Saint-Hilaire Sud',
        region: 'saint hilaire',
      })
    ).toBe('Saint-Hilaire Sud');
    expect(
      getSiteDisplayName({ name: 'Besancon Planoise', region: 'Besançon' })
    ).toBe('Besancon Planoise');
  });
});

describe('isSiteLocalityDisplayed', () => {
  it('returns true when a locality is available for display', () => {
    expect(
      isSiteLocalityDisplayed({ name: 'Arguel', region: 'Besançon' })
    ).toBe(true);
  });

  it('returns false when no locality is available', () => {
    expect(isSiteLocalityDisplayed({ name: 'Arguel', region: '' })).toBe(false);
  });
});
