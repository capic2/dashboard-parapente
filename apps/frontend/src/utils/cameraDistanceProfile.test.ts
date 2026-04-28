import { describe, expect, it } from 'vitest';
import { getFlightCameraDistance } from './cameraDistanceProfile';

describe('getFlightCameraDistance', () => {
  it('zooms in at takeoff and landing', () => {
    const baseDistance = 1000;

    expect(
      getFlightCameraDistance({
        progress: 0,
        baseDistance,
        closeZoomPercent: 75,
        transitionPercent: 12,
      })
    ).toBe(750);

    expect(
      getFlightCameraDistance({
        progress: 1,
        baseDistance,
        closeZoomPercent: 75,
        transitionPercent: 12,
      })
    ).toBe(750);
  });

  it('uses the configured distance during cruise', () => {
    expect(
      getFlightCameraDistance({
        progress: 0.5,
        baseDistance: 1000,
        closeZoomPercent: 75,
        transitionPercent: 12,
      })
    ).toBe(1000);
  });

  it('smoothly transitions between close and configured distance', () => {
    const baseDistance = 1000;
    const start = getFlightCameraDistance({
      progress: 0,
      baseDistance,
      closeZoomPercent: 75,
      transitionPercent: 12,
    });
    const duringTransition = getFlightCameraDistance({
      progress: 0.06,
      baseDistance,
      closeZoomPercent: 75,
      transitionPercent: 12,
    });
    const afterTransition = getFlightCameraDistance({
      progress: 0.12,
      baseDistance,
      closeZoomPercent: 75,
      transitionPercent: 12,
    });

    expect(duringTransition).toBeGreaterThan(start);
    expect(duringTransition).toBeLessThan(afterTransition);
    expect(afterTransition).toBe(baseDistance);
  });

  it('clamps unsafe configuration values', () => {
    expect(
      getFlightCameraDistance({
        progress: 0,
        baseDistance: 1000,
        closeZoomPercent: 5,
        transitionPercent: 100,
      })
    ).toBe(300);

    expect(
      getFlightCameraDistance({
        progress: 0.2,
        baseDistance: 1000,
        closeZoomPercent: 75,
        transitionPercent: 100,
      })
    ).toBe(875);

    expect(
      getFlightCameraDistance({
        progress: 0.02,
        baseDistance: 1000,
        closeZoomPercent: 75,
        transitionPercent: 0,
      })
    ).toBe(1000);
  });
});
