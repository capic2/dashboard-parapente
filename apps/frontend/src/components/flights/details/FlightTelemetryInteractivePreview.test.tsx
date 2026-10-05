import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  youtubeAssociations: [] as {
    url: string;
    title?: string | null;
  }[],
  exportStatus: null as {
    status: string;
    progress?: number;
    message?: string | null;
    error?: string | null;
    internal_status?: string;
    created_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    updated_at?: string | null;
    eta_seconds?: number;
    frames_captured?: number;
    total_frames?: number;
    log_tail?: string[];
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
  formatEta: () => null,
}));

vi.mock('../../../hooks/flights/useYoutubeUpload', () => ({
  useYoutubeVideoAssociations: () => ({ data: hooks.youtubeAssociations }),
  useUploadYoutubeDownloadCookies: () => ({ mutateAsync: vi.fn() }),
  useYoutubeUpload: () => ({ data: null }),
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
    pips,
    syncOffsetSeconds,
    pipOffsetSeconds,
    youtubeUrl,
  }: {
    onTimeChange?: (time: number) => void;
    overlayContent?: React.ReactNode;
    pips?: {
      id: string;
      source?: string;
      x: number;
      y: number;
      width: number;
      height: number;
      youtubeUrl?: string;
      videoUrl?: string;
    }[];
    syncOffsetSeconds?: number;
    pipOffsetSeconds?: number;
    youtubeUrl?: string;
  }) => (
    <>
      <button
        type="button"
        data-testid="overlay-player"
        aria-label="mock overlay player"
        onClick={() => onTimeChange?.(180)}
      />
      {pips?.map((pip) => (
        <div
          key={pip.id}
          data-testid={`player-pip-${pip.id}`}
          data-source={pip.source}
          data-x={pip.x}
          data-y={pip.y}
          data-width={pip.width}
          data-height={pip.height}
          data-youtube-url={pip.youtubeUrl}
          data-video-url={pip.videoUrl}
        />
      ))}
      <div data-testid="player-sync-offset" data-offset={syncOffsetSeconds} />
      <div data-testid="player-pip-offset" data-offset={pipOffsetSeconds} />
      <div data-testid="player-youtube-main" data-url={youtubeUrl} />
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

  it('falls back to an available YouTube video and keeps telemetry visible', () => {
    const availableUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    hooks.youtubeAssociations = [
      { url: availableUrl, title: 'Vol du 02/10/2026 - face' },
    ];
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
    } as FlightTelemetryData;
    hooks.telemetry.isPending = false;
    hooks.telemetry.isSuccess = true;
    hooks.layout.data = {
      layout: Object.assign([], { mainVideoSource: 'youtube:vol' }),
    };
    hooks.layout.isPending = false;
    hooks.layout.isSuccess = true;
    const onCurrentYoutubePositionChange = vi.fn();

    render(
      <FlightTelemetryInteractivePreview
        flightId="flight-1"
        youtubeUrls={[availableUrl]}
        onCurrentYoutubePositionChange={onCurrentYoutubePositionChange}
      />
    );

    expect(screen.getByTestId('player-youtube-main')).toHaveAttribute(
      'data-url',
      availableUrl
    );
    expect(screen.getByTestId('telemetry-overlay')).toBeInTheDocument();
    expect(
      screen.queryByText('telemetryLayout.mainVideoUnavailable')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('overlay-player'));
    expect(onCurrentYoutubePositionChange).toHaveBeenCalledWith({
      videoId: 'dQw4w9WgXcQ',
      seconds: 180,
    });

    hooks.overlayPreview.data = undefined;
    hooks.overlayPreview.isPending = true;
    hooks.overlayPreview.isSuccess = false;
    hooks.overlayPreview.isError = false;
    hooks.telemetry.data = undefined;
    hooks.telemetry.isPending = true;
    hooks.telemetry.isSuccess = false;
    hooks.telemetry.isError = false;
    hooks.layout.data = undefined;
    hooks.layout.isPending = true;
    hooks.layout.isSuccess = false;
    hooks.youtubeAssociations = [];
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
    hooks.layout.data = {
      layout: [
        {
          id: 'no-offset-pip',
          type: 'pip',
          action: 'switch_video',
          source: 'file:face',
          applyOffset: false,
          x: 100,
          y: 100,
          width: 300,
          height: 180,
          visible: true,
        },
        {
          id: 'offset-pip',
          type: 'pip',
          action: 'switch_video',
          source: 'file:vol',
          applyOffset: true,
          x: 500,
          y: 100,
          width: 300,
          height: 180,
          visible: true,
        },
      ],
    };

    render(<FlightTelemetryInteractivePreview flightId="flight-1" />);

    fireEvent.click(screen.getByTestId('overlay-player'));
    expect(screen.getByTestId('telemetry-overlay')).toBeInTheDocument();
    expect(
      screen.getByTestId('telemetry-overlay').getAttribute('data-video-time')
    ).toBe('1200');
    expect(
      screen.getByTestId('telemetry-overlay').getAttribute('data-offset')
    ).toBe('30.9');
    expect(screen.getByTestId('player-pip-offset')).toHaveAttribute(
      'data-offset',
      '30.9'
    );
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

    expect(screen.getByTestId('player-pip-video-pip')).toHaveAttribute(
      'data-x',
      '0.02'
    );
    expect(screen.getByTestId('player-pip-video-pip')).toHaveAttribute(
      'data-y',
      '0.78'
    );
    expect(
      Number(
        screen.getByTestId('player-pip-video-pip').getAttribute('data-width')
      )
    ).toBeCloseTo(0.18);
    expect(
      Number(
        screen.getByTestId('player-pip-video-pip').getAttribute('data-height')
      )
    ).toBeCloseTo(0.18);
  });

  it('matches the PiP YouTube source to the video title suffix', () => {
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
          source: 'youtube:face',
          x: 38.4,
          y: 842.4,
          width: 345.6,
          height: 194.4,
          visible: true,
        },
        {
          id: 'pilot-pip',
          type: 'pip',
          action: 'switch_video',
          source: 'youtube:pilote',
          x: 600,
          y: 300,
          width: 345.6,
          height: 194.4,
          visible: true,
        },
      ],
    };
    const faceUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const pilotUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
    hooks.youtubeAssociations = [
      { url: faceUrl, title: 'Vol du 02/10/2026 - face' },
      { url: pilotUrl, title: 'Vol du 02/10/2026 - pilote' },
    ];

    render(
      <FlightTelemetryInteractivePreview
        flightId="flight-1"
        youtubeUrls={[faceUrl, pilotUrl]}
      />
    );

    expect(screen.getByTestId('player-pip-video-pip')).not.toHaveAttribute(
      'data-youtube-url'
    );
    expect(screen.getByTestId('player-pip-pilot-pip')).toHaveAttribute(
      'data-youtube-url',
      pilotUrl
    );
    expect(screen.getByTestId('player-youtube-main')).toHaveAttribute(
      'data-url',
      faceUrl
    );
    expect(screen.getByTestId('player-pip-video-pip')).toHaveAttribute(
      'data-source',
      'youtube:face'
    );
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

  it('uses the combined calibration offset and GPX origin for a YouTube dynamic overlay', () => {
    hooks.overlayPreview.data = {
      video: { preview_segments: [] },
      alignment: {
        automatic_offset_seconds: -156,
        manual_offset_seconds: 5.9,
        effective_offset_seconds: -150.1,
      },
      gpx: {
        coordinates: [{ timestamp: Date.UTC(2026, 8, 5, 16, 40, 53) }],
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
      '-150.1'
    );
    expect(screen.getByTestId('player-sync-offset')).toHaveAttribute(
      'data-offset',
      '-150.1'
    );
    expect(screen.getByTestId('telemetry-overlay')).toHaveAttribute(
      'data-timeline-start',
      String(Date.UTC(2026, 8, 5, 16, 40, 53))
    );
  });

  it('shows the current phase, timing, and latest export events', async () => {
    hooks.exportStatus = {
      status: 'processing',
      internal_status: 'running',
      progress: 5,
      message: 'Génération de l’overlay synchronisé: 5%',
      created_at: new Date(Date.now() - 120_000).toISOString(),
      started_at: new Date(Date.now() - 115_000).toISOString(),
      updated_at: new Date(Date.now() - 2_000).toISOString(),
      log_tail: [
        'Préparation de l’export YouTube',
        'Génération de l’overlay synchronisé: 5%',
      ],
    };
    window.sessionStorage.setItem(
      'youtube-overlay-export-job:flight-1',
      'active-export-job'
    );

    render(
      <FlightTelemetryInteractivePreview
        flightId="flight-1"
        youtubeUrls={['https://www.youtube.com/watch?v=dQw4w9WgXcQ']}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByText('flights.youtubeOverlayExportPhaseOverlay')
      ).toBeInTheDocument()
    );
    expect(
      screen.getByText('flights.youtubeOverlayExportElapsed')
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Génération de l’overlay synchronisé: 5%/u).length
    ).toBeGreaterThan(1);
    expect(
      screen.getByText('flights.youtubeOverlayExportShowLogs')
    ).toBeInTheDocument();
    window.sessionStorage.removeItem('youtube-overlay-export-job:flight-1');
  });
});
