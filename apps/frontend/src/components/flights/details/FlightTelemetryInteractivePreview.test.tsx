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
    data: undefined as { layout: unknown[] } | undefined,
    isPending: true,
    isSuccess: false,
  },
  exportStatus: null as {
    status: string;
    progress?: number;
    message?: string | null;
    error?: string | null;
  } | null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  withTranslation: () => (Component: React.ComponentType) => Component,
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
  interpolateTelemetryAtVideoTime: () => null,
}));

vi.mock('../../../hooks/flights/useTelemetryLayout', () => ({
  useTelemetryLayout: () => hooks.layout,
}));

vi.mock('../../../hooks/flights/useVideoExportStatus', () => ({
  useVideoExportStatus: () => ({ status: hooks.exportStatus }),
}));

vi.mock('../../../hooks/flights/useYoutubeUpload', () => ({
  useStartYoutubeOverlayExport: () => ({
    isPending: false,
    isError: false,
    mutateAsync: vi.fn().mockResolvedValue({
      job_id: 'export-job-1',
      status: 'queued',
    }),
  }),
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => null,
}));

vi.mock('./FlightOverlayPlayer', () => ({
  FlightOverlayPlayer: ({
    onTimeChange,
    overlayContent,
    pipLayout,
    syncOffsetSeconds,
  }: {
    onTimeChange?: (time: number) => void;
    overlayContent?: React.ReactNode;
    pipLayout?: { x: number; y: number; width: number; height: number };
    syncOffsetSeconds?: number;
  }) => (
    <>
      <button
        type="button"
        data-testid="overlay-player"
        aria-label="mock overlay player"
        onClick={() => onTimeChange?.(180)}
      />
      <div
        data-testid="player-pip-layout"
        data-x={pipLayout?.x}
        data-y={pipLayout?.y}
        data-width={pipLayout?.width}
        data-height={pipLayout?.height}
      />
      <div data-testid="player-sync-offset" data-offset={syncOffsetSeconds} />
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

  it('converts the saved pixel PiP bounds to player-relative fractions', () => {
    hooks.overlayPreview.data = {
      video: { preview_segments: [] },
      alignment: { automatic_offset_seconds: 0, manual_offset_seconds: 0 },
      gpx: { coordinates: [] },
    } as unknown as GoproOverlayPreview;
    hooks.overlayPreview.isPending = false;
    hooks.overlayPreview.isSuccess = true;
    hooks.telemetry.data = {
      points: [
        {
          timestamp: 0,
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
    hooks.layout.isPending = false;
    hooks.layout.isSuccess = true;
    hooks.layout.data = {
      layout: [
        {
          id: 'video-pip',
          type: 'pip',
          action: 'switch_video',
          x: 38.4,
          y: 842.4,
          width: 345.6,
          height: 194.4,
          visible: true,
        },
      ],
    };

    render(<FlightTelemetryInteractivePreview flightId="flight-1" />);

    expect(screen.getByTestId('player-pip-layout')).toHaveAttribute(
      'data-x',
      '0.02'
    );
    expect(screen.getByTestId('player-pip-layout')).toHaveAttribute(
      'data-y',
      '0.78'
    );
    expect(
      Number(screen.getByTestId('player-pip-layout').getAttribute('data-width'))
    ).toBeCloseTo(0.18);
    expect(
      Number(
        screen.getByTestId('player-pip-layout').getAttribute('data-height')
      )
    ).toBeCloseTo(0.18);
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

  it('uses only the manual offset for a YouTube dynamic overlay', () => {
    hooks.overlayPreview.data = {
      video: { preview_segments: [] },
      alignment: {
        automatic_offset_seconds: -156,
        manual_offset_seconds: 5.9,
        effective_offset_seconds: -150.1,
      },
      gpx: { coordinates: [] },
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
      duration_seconds: 10,
    };
    hooks.telemetry.isPending = false;
    hooks.telemetry.isSuccess = true;
    hooks.layout.isPending = false;
    hooks.layout.isSuccess = true;
    hooks.layout.data = { layout: [] };

    render(
      <FlightTelemetryInteractivePreview
        flightId="flight-1"
        manualOffsetSeconds={5.9}
        youtubeUrls={['https://www.youtube.com/watch?v=dQw4w9WgXcQ']}
      />
    );

    fireEvent.click(screen.getByTestId('overlay-player'));
    expect(screen.getByTestId('telemetry-overlay')).toHaveAttribute(
      'data-offset',
      '5.9'
    );
    expect(screen.getByTestId('player-sync-offset')).toHaveAttribute(
      'data-offset',
      '5.9'
    );
    expect(screen.getByTestId('telemetry-overlay')).toHaveAttribute(
      'data-timeline-start',
      String(Date.UTC(2026, 8, 5, 16, 44, 53))
    );
  });
});
