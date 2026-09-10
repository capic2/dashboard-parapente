import { describe, expect, it } from 'vitest';
import { getFlightCameraShot } from './cameraDirector';

describe('getFlightCameraShot', () => {
  it('starts with a close takeoff plan', () => {
    expect(getFlightCameraShot({ progress: 0, baseDistance: 500 })).toEqual({
      type: 'takeoff',
      distance: 200,
      pitch: -0.22,
    });
  });

  it('uses the full distance for the follow plan', () => {
    expect(getFlightCameraShot({ progress: 0.5, baseDistance: 500 })).toEqual({
      type: 'follow',
      distance: 500,
      pitch: -0.05,
    });
  });

  it('ends with a close landing plan', () => {
    expect(getFlightCameraShot({ progress: 1, baseDistance: 500 })).toEqual({
      type: 'landing',
      distance: 200,
      pitch: -0.22,
    });
  });

  it('interpolates smoothly between plans', () => {
    const shot = getFlightCameraShot({ progress: 0.2, baseDistance: 500 });

    expect(shot.type).toBe('follow');
    expect(shot.distance).toBeGreaterThan(200);
    expect(shot.distance).toBeLessThan(500);
    expect(shot.pitch).toBeGreaterThan(-0.22);
    expect(shot.pitch).toBeLessThan(-0.05);
  });

  it('falls back to a safe camera plan for non-finite inputs', () => {
    expect(
      getFlightCameraShot({ progress: Number.NaN, baseDistance: Infinity })
    ).toEqual({
      type: 'takeoff',
      distance: 0,
      pitch: -0.22,
    });
  });

  it('respects the camera zoom and transition settings saved for a site', () => {
    expect(
      getFlightCameraShot({
        progress: 0,
        baseDistance: 500,
        closeZoomPercent: 60,
        transitionPercent: 20,
      })
    ).toMatchObject({ distance: 300 });
  });

  it('caps an excessive transition to keep the camera timeline ordered', () => {
    const enteringFollowShot = getFlightCameraShot({
      progress: 0.4,
      baseDistance: 500,
      transitionPercent: 40,
    });
    const followShot = getFlightCameraShot({
      progress: 0.5,
      baseDistance: 500,
      transitionPercent: 40,
    });

    expect(enteringFollowShot.distance).toBeGreaterThanOrEqual(300);
    expect(followShot.distance).toBe(500);
  });

  it('creates a close highlight plan around an interior event', () => {
    expect(
      getFlightCameraShot({
        progress: 0.5,
        baseDistance: 500,
        highlightProgress: 0.5,
      })
    ).toEqual({
      type: 'highlight',
      distance: 250,
      pitch: -0.16,
    });
  });

  it('does not override takeoff or landing with a highlight', () => {
    expect(
      getFlightCameraShot({
        progress: 0.1,
        baseDistance: 500,
        highlightProgress: 0.1,
      }).type
    ).toBe('takeoff');

    expect(
      getFlightCameraShot({
        progress: 0.19,
        baseDistance: 500,
        highlightProgress: 0.21,
      }).type
    ).toBe('takeoff');

    expect(
      getFlightCameraShot({
        progress: 0.81,
        baseDistance: 500,
        highlightProgress: 0.79,
      }).type
    ).toBe('landing');
  });
});
