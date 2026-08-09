import type { Flight } from '../types';
import { HTTPError } from 'ky';

export const GOPRO_OVERLAY_IN_PROGRESS_STATUSES = new Set([
  'queued',
  'preparing',
  'running',
]);

export function hasFlightVideo(flight: Flight): boolean {
  return Boolean(flight.video_file_path && flight.video_file_exists === true);
}

export function hasFlightGoproOverlay(flight: Flight): boolean {
  return Boolean(
    flight.gopro_overlay_file_path && flight.gopro_overlay_file_exists === true
  );
}

export function isGoproOverlayInProgress(status?: string | null): boolean {
  return Boolean(status && GOPRO_OVERLAY_IN_PROGRESS_STATUSES.has(status));
}

export function isUnavailableMediaError(error: unknown): boolean {
  return (
    error instanceof HTTPError && [404, 410].includes(error.response.status)
  );
}
