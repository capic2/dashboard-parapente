import { describe, expect, it } from 'vitest';
import { HTTPError } from 'ky';
import type { Flight } from '../types';
import {
  hasFlightGoproOverlay,
  hasFlightVideo,
  isGoproOverlayInProgress,
  isUnavailableMediaError,
} from './flightMediaState';

const flight = (overrides: Partial<Flight>): Flight =>
  ({
    id: 'flight-1',
    flight_date: '2026-03-15',
    ...overrides,
  }) as Flight;

describe('flight media state', () => {
  it('requires confirmed file existence for downloadable media', () => {
    expect(
      hasFlightVideo(
        flight({
          video_file_path: '/exports/video.mp4',
          video_file_exists: true,
        })
      )
    ).toBe(true);
    expect(
      hasFlightVideo(
        flight({
          video_file_path: '/exports/video.mp4',
          video_file_exists: false,
        })
      )
    ).toBe(false);
    expect(
      hasFlightGoproOverlay(
        flight({
          gopro_overlay_file_path: '/exports/final.mp4',
          gopro_overlay_file_exists: true,
        })
      )
    ).toBe(true);
    expect(
      hasFlightGoproOverlay(
        flight({
          gopro_overlay_file_path: '/exports/final.mp4',
          gopro_overlay_file_exists: undefined,
        })
      )
    ).toBe(false);
  });

  it('treats preparing overlay jobs as in progress', () => {
    expect(isGoproOverlayInProgress('queued')).toBe(true);
    expect(isGoproOverlayInProgress('preparing')).toBe(true);
    expect(isGoproOverlayInProgress('running')).toBe(true);
    expect(isGoproOverlayInProgress('completed')).toBe(false);
  });

  it('marks only missing or expired media responses unavailable', () => {
    const httpError = (status: number) => {
      const error = Object.create(HTTPError.prototype) as HTTPError;
      Object.defineProperty(error, 'response', {
        value: new Response(null, { status }),
      });
      return error;
    };

    expect(isUnavailableMediaError(httpError(404))).toBe(true);
    expect(isUnavailableMediaError(httpError(410))).toBe(true);
    expect(isUnavailableMediaError(httpError(500))).toBe(false);
    expect(isUnavailableMediaError(new TypeError('Network error'))).toBe(false);
  });
});
