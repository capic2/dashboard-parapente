import { describe, expect, it } from 'vitest';
import {
  getBearingRadians,
  getInterpolatedElevationOffset,
  getRenderedTrackElevation,
} from './flightViewerTrackPlacement';

describe('flightViewerTrackPlacement', () => {
  it('keeps a single takeoff offset when no landing offset is known', () => {
    expect(getInterpolatedElevationOffset(2, 5, 40, null)).toBe(40);
  });

  it('interpolates elevation offsets from takeoff to landing', () => {
    expect(getInterpolatedElevationOffset(0, 5, 40, -20)).toBe(40);
    expect(getInterpolatedElevationOffset(2, 5, 40, -20)).toBe(10);
    expect(getInterpolatedElevationOffset(4, 5, 40, -20)).toBe(-20);
  });

  it('adjusts only rendered elevation, not latitude or longitude', () => {
    const point = { lat: 45.12, lon: 6.34, elevation: 800 };

    expect(getRenderedTrackElevation(point, 1, 3, 100, -50)).toBe(825);
    expect(point).toEqual({ lat: 45.12, lon: 6.34, elevation: 800 });
  });

  it('computes bearings with radians, not degree deltas', () => {
    expect(
      getBearingRadians(
        { lat: 45, lon: 6, elevation: 0 },
        { lat: 46, lon: 6, elevation: 0 }
      )
    ).toBeCloseTo(0, 6);
    expect(
      getBearingRadians(
        { lat: 45, lon: 6, elevation: 0 },
        { lat: 45, lon: 7, elevation: 0 }
      )
    ).toBeCloseTo(1.564626, 6);
  });
});
