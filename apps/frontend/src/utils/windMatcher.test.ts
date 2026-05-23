import { describe, expect, it } from 'vitest';
import {
  getWindFavorability,
  getWindFavorabilityColor,
  getWindFavorabilityLabel,
} from './windMatcher';

describe('getWindFavorability', () => {
  it('returns moderate when wind or site direction is missing', () => {
    expect(getWindFavorability(undefined, 'N')).toBe('moderate');
    expect(getWindFavorability('N', undefined)).toBe('moderate');
  });

  it('prioritizes unsafe or very light wind speed over direction matching', () => {
    expect(getWindFavorability('S', 'N', 4)).toBe('good');
    expect(getWindFavorability('N', 'N', 41)).toBe('bad');
  });

  it('returns good when wind is within 45 degrees of takeoff orientation', () => {
    expect(getWindFavorability('N', 'N')).toBe('good');
    expect(getWindFavorability('NE', 'N')).toBe('good');
  });

  it('returns moderate when wind is between 45 and 90 degrees off orientation', () => {
    expect(getWindFavorability('ENE', 'N')).toBe('moderate');
    expect(getWindFavorability('E', 'N')).toBe('moderate');
  });

  it('returns bad when wind is more than 90 degrees off orientation', () => {
    expect(getWindFavorability('ESE', 'N')).toBe('bad');
    expect(getWindFavorability('S', 'N')).toBe('bad');
  });

  it('handles compass wrap-around and lower-case directions', () => {
    expect(getWindFavorability('NNW', 'N')).toBe('good');
    expect(getWindFavorability('n', 'nnw')).toBe('good');
  });
});

describe('getWindFavorabilityLabel', () => {
  it('returns French labels by default', () => {
    expect(getWindFavorabilityLabel('good')).toBe('Vent favorable');
    expect(getWindFavorabilityLabel('moderate')).toBe('Vent acceptable');
    expect(getWindFavorabilityLabel('bad')).toBe('Vent défavorable');
  });

  it('returns English labels for non-French locales', () => {
    expect(getWindFavorabilityLabel('good', 'en')).toBe('Favorable wind');
    expect(getWindFavorabilityLabel('moderate', 'en')).toBe('Acceptable wind');
    expect(getWindFavorabilityLabel('bad', 'en')).toBe('Unfavorable wind');
  });
});

describe('getWindFavorabilityColor', () => {
  it('maps favorability to Tailwind text color classes', () => {
    expect(getWindFavorabilityColor('good')).toBe('text-green-500');
    expect(getWindFavorabilityColor('moderate')).toBe('text-yellow-500');
    expect(getWindFavorabilityColor('bad')).toBe('text-red-500');
  });
});
