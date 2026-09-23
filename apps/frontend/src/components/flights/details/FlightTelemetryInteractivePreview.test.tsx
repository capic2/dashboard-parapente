import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { GoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import type { FlightTelemetryData } from '../../../hooks/flights/useFlightTelemetry';
import { FlightTelemetryInteractivePreview } from './FlightTelemetryInteractivePreview';

const hooks = vi.hoisted(() => ({
  overlayPreview: {
    data: null as unknown as GoproOverlayPreview | undefined,
    isPending: true,
    isSuccess: false,
    isError: false,
  },
  telemetry: {
    data: null as unknown as FlightTelemetryData | undefined,
    isPending: true,
    isSuccess: false,
    isError: false,
  },
  layout: {
    data: undefined as { layout: never[] } | undefined,
    isPending: true,
    isSuccess: false,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/layout">{children}</a>
  ),
}));

vi.mock('../../../hooks/gopro/useGoproOverlay', () => ({
  useGoproOverlayPreview: () => hooks.overlayPreview,
}));

vi.mock('../../../hooks/flights/useFlightTelemetry', () => ({
  useFlightTelemetry: () => hooks.telemetry,
}));

vi.mock('../../../hooks/flights/useTelemetryLayout', () => ({
  useTelemetryLayout: () => hooks.layout,
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
    offsetSeconds,
    timelineStartTimestamp,
  }: {
    videoTimeSeconds: number;
    offsetSeconds: number;
    timelineStartTimestamp?: number;
  }) => (
    <div
      data-testid="telemetry-overlay"
      data-video-time={videoTimeSeconds}
      data-offset={offsetSeconds}
      data-timeline-start={timelineStartTimestamp}
    />
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
    hooks.layout.isPending = false;

    render(<FlightTelemetryInteractivePreview flightId="flight-1" />);

    expect(
      screen.getAllByText('flights.overlayInteractivePreviewUnavailable')
    ).toHaveLength(2);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('uses the GPX origin and combined calibration offset', () => {
    hooks.overlayPreview.data = {
      video: {
        start_time: '2026-09-05T16:27:53',
        preview_segments: [
          {
            preview_start_seconds: 0,
            source_start_seconds: 1020,
            duration_seconds: 180,
          },
        ],
      },
      alignment: {
        automatic_offset_seconds: 25,
        manual_offset_seconds: 5.9,
        effective_offset_seconds: 30.9,
      },
      gpx: {
        start_time: '2026-09-05T16:44:55Z',
        end_time: '2026-09-05T16:45:05Z',
        duration_seconds: 10,
        coordinates: [
          {
            timestamp: Date.UTC(2026, 8, 5, 16, 44, 55),
            lat: 0,
            lon: 0,
            elevation: 0,
          },
        ],
      },
    } as unknown as GoproOverlayPreview;
    hooks.overlayPreview.isPending = false;
    hooks.overlayPreview.isSuccess = true;
    hooks.telemetry.data = {
      points: [
        {
          timestamp: Date.UTC(2026, 8, 5, 16, 44, 53),
          lat: 0,
          lon: 0,
          elevation: 0,
          segment: 0,
        },
      ],
      source: 'gpx+osv',
      has_osv: true,
      enrichment_status: 'ready',
      start_time: '2026-09-05T16:44:53Z',
      end_time: null,
      duration_seconds: 0,
    };
    hooks.telemetry.isPending = false;
    hooks.telemetry.isSuccess = true;
    hooks.layout.isPending = false;
    hooks.layout.isSuccess = true;
    hooks.layout.data = { layout: [] };

    render(<FlightTelemetryInteractivePreview flightId="flight-1" />);

    fireEvent.click(screen.getByTestId('overlay-player'));
    expect(screen.getByTestId('telemetry-overlay')).toBeInTheDocument();
    expect(
      screen.getByTestId('telemetry-overlay').getAttribute('data-video-time')
    ).toBe('1200');
    expect(
      screen.getByTestId('telemetry-overlay').getAttribute('data-offset')
    ).toBe('30.9');
    expect(
      screen
        .getByTestId('telemetry-overlay')
        .getAttribute('data-timeline-start')
    ).toBe(String(Date.UTC(2026, 8, 5, 16, 44, 55)));
  });

  it('uses the saved flight offset immediately when the preview query is stale', () => {
    hooks.overlayPreview.data = {
      video: {
        start_time: '2026-09-05T16:27:53Z',
        preview_segments: [
          {
            preview_start_seconds: 0,
            source_start_seconds: 0,
            duration_seconds: 180,
          },
        ],
      },
      alignment: {
        automatic_offset_seconds: 25,
        manual_offset_seconds: 0,
        effective_offset_seconds: 25,
      },
    } as unknown as GoproOverlayPreview;
    hooks.overlayPreview.isPending = false;
    hooks.overlayPreview.isSuccess = true;
    hooks.telemetry.data = {
      points: [
        {
          timestamp: Date.UTC(2026, 8, 5, 16, 27, 53),
          lat: 0,
          lon: 0,
          elevation: 0,
          segment: 0,
        },
      ],
      source: 'gpx',
      has_osv: false,
      enrichment_status: 'ready',
      start_time: '2026-09-05T16:27:53Z',
      end_time: null,
      duration_seconds: 0,
    };
    hooks.telemetry.isPending = false;
    hooks.telemetry.isSuccess = true;
    hooks.layout.isPending = false;
    hooks.layout.isSuccess = true;
    hooks.layout.data = { layout: [] };

    render(
      <FlightTelemetryInteractivePreview
        flightId="flight-1"
        manualOffsetSeconds={12.5}
      />
    );

    expect(screen.getByTestId('telemetry-overlay')).toHaveAttribute(
      'data-offset',
      '37.5'
    );
    expect(screen.getByTestId('telemetry-overlay')).toHaveAttribute(
      'data-timeline-start',
      String(Date.UTC(2026, 8, 5, 16, 27, 53))
    );
  });
});
