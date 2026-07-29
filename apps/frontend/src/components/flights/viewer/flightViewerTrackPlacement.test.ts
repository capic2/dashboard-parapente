import { describe, expect, it } from 'vitest';
import {
  getBearingRadians,
  getInterpolatedElevationOffset,
  getReliableEndpointElevation,
  getRenderedTrackElevation,
  getTerrainElevationOffset,
  repairTrackEndpointElevations,
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

  it('ignores an isolated invalid takeoff elevation', () => {
    const points = [0, 470.2, 470.2, 470.2].map((elevation) => ({
      lat: 47.194,
      lon: 5.989,
      elevation,
    }));

    expect(getReliableEndpointElevation(points, 'takeoff')).toBe(470.2);
  });

  it('ignores an isolated invalid landing elevation', () => {
    const points = [254.8, 254.6, 254.4, 0].map((elevation) => ({
      lat: 47.202,
      lon: 5.988,
      elevation,
    }));

    expect(getReliableEndpointElevation(points, 'landing')).toBe(254.6);
  });

  it('keeps valid endpoint elevations unchanged', () => {
    const points = [470, 472, 474, 476].map((elevation) => ({
      lat: 47.194,
      lon: 5.989,
      elevation,
    }));

    expect(getReliableEndpointElevation(points, 'takeoff')).toBe(470);
  });

  it('preserves a real sea-level track', () => {
    const points = [0, 0, 0.2, 0.1].map((elevation) => ({
      lat: 43.3,
      lon: 5.4,
      elevation,
    }));

    expect(getReliableEndpointElevation(points, 'takeoff')).toBe(0);
  });

  it('falls back deterministically for a single-point track', () => {
    expect(
      getReliableEndpointElevation(
        [{ lat: 47.194, lon: 5.989, elevation: 462 }],
        'landing'
      )
    ).toBe(462);
  });

  it('preserves both endpoints when a track is too short to detect outliers', () => {
    const points = [1000, 1100].map((elevation) => ({
      lat: 45,
      lon: 6,
      elevation,
    }));

    expect(repairTrackEndpointElevations(points)).toEqual(points);
  });

  it('calculates terrain offset from the reliable endpoint elevation', () => {
    const points = [0, 470.2, 470.2, 470.2].map((elevation) => ({
      lat: 47.194,
      lon: 5.989,
      elevation,
    }));

    expect(getTerrainElevationOffset(462, points, 'takeoff')).toBeCloseTo(-8.2);
  });

  it('repairs only invalid track endpoints without mutating source data', () => {
    const points = [0, 470.2, 470.2, 470.2].map((elevation) => ({
      lat: 47.194,
      lon: 5.989,
      elevation,
    }));

    const repaired = repairTrackEndpointElevations(points);

    expect(repaired.map((point) => point.elevation)).toEqual([
      470.2, 470.2, 470.2, 470.2,
    ]);
    expect(points[0].elevation).toBe(0);
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
