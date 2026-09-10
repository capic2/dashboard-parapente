import { describe, expect, it } from 'vitest';
import {
  getHighestAltitudeHighlightProgress,
  getStrongestTurnHighlightProgress,
} from './flightHighlight';

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

describe('getStrongestTurnHighlightProgress', () => {
  it('returns the strongest interior course change', () => {
    expect(
      getStrongestTurnHighlightProgress([
        { lat: 45, lon: 6 },
        { lat: 45, lon: 6.01 },
        { lat: 45.01, lon: 6.01 },
        { lat: 45.02, lon: 6.01 },
        { lat: 45.03, lon: 6.01 },
      ])
    ).toBe(0.25);
  });

  it('ignores gentle turns and edge events', () => {
    expect(
      getStrongestTurnHighlightProgress([
        { lat: 45, lon: 6 },
        { lat: 45, lon: 6.01 },
        { lat: 45.001, lon: 6.02 },
        { lat: 45.002, lon: 6.03 },
        { lat: 45.003, lon: 6.04 },
      ])
    ).toBeUndefined();
  });

  it('ignores repeated GPS points', () => {
    expect(
      getStrongestTurnHighlightProgress([
        { lat: 45, lon: 6 },
        { lat: 45, lon: 6 },
        { lat: 45.01, lon: 6 },
        { lat: 45.02, lon: 6 },
        { lat: 45.03, lon: 6 },
      ])
    ).toBeUndefined();
  });
});
