import { describe, expect, it } from 'vitest';
import { getHighestAltitudeHighlightProgress } from './flightHighlight';

describe('getHighestAltitudeHighlightProgress', () => {
  it('returns the progress of an interior highest point', () => {
    expect(
      getHighestAltitudeHighlightProgress([
        { elevation: 800 },
        { elevation: 1200 },
        { elevation: 1000 },
        { elevation: 900 },
      ])
    ).toBe(1 / 3);
  });

  it('ignores a high point during takeoff or landing', () => {
    expect(
      getHighestAltitudeHighlightProgress([
        { elevation: 1200 },
        { elevation: 900 },
        { elevation: 800 },
      ])
    ).toBeUndefined();
  });
});
