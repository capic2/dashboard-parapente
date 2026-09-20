import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FlightTelemetryInteractivePreview } from './FlightTelemetryInteractivePreview';

const hooks = vi.hoisted(() => ({
  overlayPreview: {
    data: undefined,
    isPending: true,
    isSuccess: false,
    isError: false,
  },
  telemetry: {
    data: undefined,
    isPending: true,
    isSuccess: false,
    isError: false,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../hooks/gopro/useGoproOverlay', () => ({
  useGoproOverlayPreview: () => hooks.overlayPreview,
}));

vi.mock('../../../hooks/flights/useFlightTelemetry', () => ({
  useFlightTelemetry: () => hooks.telemetry,
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => null,
}));

vi.mock('./FlightOverlayPlayer', () => ({
  FlightOverlayPlayer: ({
    onTimeChange,
    overlayContent,
  }: {
    onTimeChange?: (time: number) => void;
    overlayContent?: React.ReactNode;
  }) => (
    <>
      <button
        type="button"
        data-testid="overlay-player"
        aria-label="mock overlay player"
        onClick={() => onTimeChange?.(180)}
      />
      {overlayContent}
    </>
  ),
}));

vi.mock('./FlightTelemetryOverlay', () => ({
  FlightTelemetryOverlay: ({
    videoTimeSeconds,
  }: {
    videoTimeSeconds: number;
  }) => (
    <div data-testid="telemetry-overlay" data-video-time={videoTimeSeconds} />
  ),
}));

describe('FlightTelemetryInteractivePreview', () => {
  it('shows a loading state while telemetry requests are pending', () => {
    render(<FlightTelemetryInteractivePreview flightId="flight-1" />);

    expect(
      screen.getAllByText('flights.overlayInteractivePreviewLoading')
    ).toHaveLength(2);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.queryByText('flights.overlayInteractivePreviewUnavailable')
    ).not.toBeInTheDocument();
  });

  it('shows unavailable only after a request has failed', () => {
    hooks.overlayPreview.isPending = false;
    hooks.overlayPreview.isError = true;
    hooks.telemetry.isPending = false;
    hooks.telemetry.isError = true;

    render(<FlightTelemetryInteractivePreview flightId="flight-1" />);

    expect(
      screen.getAllByText('flights.overlayInteractivePreviewUnavailable')
    ).toHaveLength(2);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('maps preview time to source video time before applying the telemetry offset', () => {
    hooks.overlayPreview.data = {
      video: {
        preview_segments: [
          {
            preview_start_seconds: 0,
            source_start_seconds: 1020,
            duration_seconds: 180,
          },
        ],
      },
      alignment: { effective_offset_seconds: 10 },
    };
    hooks.overlayPreview.isPending = false;
    hooks.overlayPreview.isSuccess = true;
    hooks.telemetry.data = {
      points: [
        {
          timestamp: 1,
          lat: 0,
          lon: 0,
          elevation: 0,
          segment: 0,
        },
      ],
      source: 'gpx',
      has_osv: false,
      enrichment_status: 'ready',
      start_time: null,
      end_time: null,
      duration_seconds: 0,
    };
    hooks.telemetry.isPending = false;
    hooks.telemetry.isSuccess = true;

    render(<FlightTelemetryInteractivePreview flightId="flight-1" />);

    fireEvent.click(screen.getByTestId('overlay-player'));
    expect(screen.getByTestId('telemetry-overlay')).toBeInTheDocument();
    expect(
      screen.getByTestId('telemetry-overlay').getAttribute('data-video-time')
    ).toBe('1200');
  });
});
