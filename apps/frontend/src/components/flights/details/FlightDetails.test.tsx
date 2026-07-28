import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Flight, Site } from '../../../types';

const {
  apiDelete,
  confirmMock,
  createOverlayMock,
  mockFlight,
  overlayJobStreamMock,
  resetOverlayMock,
  videoStatusMock,
} = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  confirmMock: vi.fn(),
  createOverlayMock: vi.fn(),
  resetOverlayMock: vi.fn(),
  overlayJobStreamMock: { current: null as unknown },
  videoStatusMock: { current: null as unknown },
  mockFlight: {
    id: 'flight-1',
    flight_date: '2026-03-15',
    title: 'Test flight',
    gpx_file_path: 'sample.gpx',
    video_file_path: '/exports/flight.mp4',
    video_file_exists: true,
    gopro_camera_file_exists: true,
    gopro_overlay_job_id: null,
    gopro_overlay_status: null,
    gopro_overlay_file_path: null,
    gopro_overlay_file_exists: undefined,
    duration_minutes: 12,
    max_altitude_m: 1000,
    max_speed_kmh: 42,
    distance_km: 3.5,
    elevation_gain_m: 250,
    notes: null,
  } as Flight,
}));

vi.mock('@dashboard-parapente/design-system', () => ({
  Button: ({
    children,
    isDisabled,
    onPress,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isDisabled?: boolean;
    onPress?: () => void;
  }) => (
    <button type="button" disabled={isDisabled} onClick={onPress} {...props}>
      {children}
    </button>
  ),
  Tab: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabList: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TabPanel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-aria-components', () => ({
  TextArea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
  TextField: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) =>
      ({
        'flights.goproOverlayCancel': 'Cancel overlay',
        'flights.goproOverlayCancelShort': 'Cancel overlay',
        'flights.goproOverlayConfirmCancel': 'Confirm cancel overlay',
        'flights.goproOverlayRegenerate': 'Regenerate overlay',
        'flights.goproOverlayRegenerateShort': 'Regenerate overlay',
        'flights.goproOverlayGenerate': 'Generate overlay',
        'flights.goproOverlayGenerateShort': 'Generate overlay',
        'flights.goproOverlayGpxOffsetLabel': 'GPX offset (seconds)',
        'flights.goproOverlayGpxOffsetHint': 'Offset hint',
        'flights.goproOverlayStarted': 'Overlay started',
        'flights.goproOverlayCancelled': 'Overlay cancelled',
        'flights.goproOverlayStartError': 'Overlay start error',
        'flights.goproOverlayCancelError': 'Overlay cancel error',
        'flights.goproOverlayNeedsVideo': 'Needs video',
        'flights.goproOverlayNeedsCameraVideo': 'Needs camera video',
        'flights.generationLogs.title': 'Generation logs',
        'flights.generationLogs.description': 'Media job tracking',
        'flights.generationLogs.videoTitle': 'Flight video',
        'flights.generationLogs.goproOverlayTitle': 'GoPro overlay',
        'flights.generationLogs.progress': 'Progress',
        'flights.generationLogs.error': 'Error',
        'flights.generationLogs.rawLogs': 'Raw logs',
        'flights.generationLogs.noLogs': 'No logs yet.',
        'flights.generationLogs.noRawLogs': 'No raw logs.',
        'flights.generationLogs.status.running': 'Running',
        'flights.generationLogs.status.encoding': 'Encoding',
        'flights.generationLogs.status.failed': 'Failed',
      })[key] ?? key,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../../hooks/flights/useFlights', () => ({
  useUpdateFlight: () => ({ mutateAsync: vi.fn() }),
  useUploadGPXToFlight: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock('../../../hooks/flights/useVideoExportStatus', () => ({
  useVideoExportStatus: () => ({ status: videoStatusMock.current }),
}));

vi.mock('../../../hooks/gopro/useGoproOverlay', () => ({
  useCreateFlightGoproOverlayJob: () => ({
    data: null,
    isPending: false,
    mutateAsync: createOverlayMock,
    reset: resetOverlayMock,
  }),
  useGoproOverlayJobStream: () => ({ job: overlayJobStreamMock.current }),
}));

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock('../../../lib/api', () => ({
  api: {
    delete: apiDelete,
  },
  getApiErrorMessage: (_error: unknown, fallback: string) =>
    Promise.resolve(fallback),
}));

vi.mock('../../../stores/appSettingsStore', () => ({
  formatAltitudeMeters: (value: number) => `${value} m`,
  formatDistanceKm: (value: number) => `${value} km`,
  formatSpeedKmh: (value: number) => `${value} km/h`,
  useAppSettingsStore: () => ({
    altitude: 'metric',
    distance: 'metric',
    speed: 'metric',
  }),
}));

vi.mock('../video-export/FlightVideoExportControls', () => ({
  FlightVideoExportControls: () => <button type="button">Video action</button>,
}));

import { FlightDetails } from './FlightDetails';

const sites: Site[] = [];

describe('FlightDetails GoPro overlay action', () => {
  beforeEach(() => {
    apiDelete.mockReset();
    createOverlayMock.mockReset();
    createOverlayMock.mockResolvedValue({ job_id: 'job-new', job_token: null });
    confirmMock.mockReset();
    confirmMock.mockReturnValue(true);
    vi.stubGlobal('confirm', confirmMock);
    overlayJobStreamMock.current = null;
    mockFlight.gopro_overlay_job_id = null;
    mockFlight.gopro_overlay_status = null;
    mockFlight.gopro_overlay_file_path = null;
    mockFlight.gopro_overlay_file_exists = undefined;
    mockFlight.gopro_overlay_progress = null;
    mockFlight.video_export_job_id = null;
    mockFlight.video_export_status = null;
    mockFlight.video_export_progress = null;
    mockFlight.video_file_path = '/exports/flight.mp4';
    mockFlight.video_file_exists = true;
    mockFlight.gopro_camera_file_exists = true;
    videoStatusMock.current = null;
  });

  it('shows why overlay generation is unavailable', () => {
    mockFlight.gopro_camera_file_exists = false;

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    expect(screen.getByText('Needs camera video')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Generate overlay/u })
    ).toBeDisabled();
  });

  it('turns the overlay button into cancel while generation is running', async () => {
    mockFlight.gopro_overlay_job_id = 'job-overlay';
    mockFlight.gopro_overlay_status = 'running';

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel overlay/u }));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith(
        'gopro-overlays/jobs/job-overlay/cancel',
        { searchParams: undefined }
      );
    });
  });

  it('passes the GPX offset when starting overlay generation', async () => {
    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    fireEvent.change(screen.getByLabelText('GPX offset (seconds)'), {
      target: { value: '2.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate overlay/u }));

    await waitFor(() => {
      expect(createOverlayMock).toHaveBeenCalled();
    });
    const formData = createOverlayMock.mock.calls[0][0] as FormData;
    expect(formData.get('gpx_offset')).toBe('2.5');
  });

  it('shows a dedicated generation logs panel for video and GoPro jobs', () => {
    mockFlight.video_export_job_id = 'video-job';
    mockFlight.video_export_status = 'running';
    overlayJobStreamMock.current = {
      job_id: 'overlay-job',
      status: 'failed',
      progress: 43,
      message: 'Rendering overlay',
      error: 'Overlay failed on frame 42',
      layout_id: 'layout',
      layout_label: 'Parapente',
      output_filename: 'final.mp4',
      created_at: '2026-03-15T14:00:00Z',
      updated_at: '2026-03-15T14:10:00Z',
      log_tail: ['Starting overlay', 'Frame 42 failed'],
    };
    videoStatusMock.current = {
      job_id: 'video-job',
      status: 'running',
      internal_status: 'encoding',
      progress: 78,
      message: 'Encoding with FFmpeg',
      log_tail: ['Captured frames', 'Encoding with FFmpeg'],
    };

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    expect(screen.getByText('Generation logs')).toBeInTheDocument();
    expect(screen.getByText('Flight video')).toBeInTheDocument();
    expect(screen.getByText('GoPro overlay')).toBeInTheDocument();
    expect(screen.getByText('Encoding with FFmpeg')).toBeInTheDocument();
    expect(screen.getByText('Overlay failed on frame 42')).toBeInTheDocument();
    expect(screen.getByText(/Frame 42 failed/u)).toBeInTheDocument();
  });

  it('does not render an empty generation logs panel', () => {
    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    expect(screen.queryByText('Generation logs')).not.toBeInTheDocument();
  });

  it('regenerates overlay after cancellation', async () => {
    mockFlight.gopro_overlay_job_id = 'job-overlay';
    mockFlight.gopro_overlay_status = 'cancelled';

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Regenerate overlay/u })
    );

    expect(createOverlayMock).toHaveBeenCalled();
  });
});
