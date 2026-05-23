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
} = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  confirmMock: vi.fn(),
  createOverlayMock: vi.fn(),
  resetOverlayMock: vi.fn(),
  overlayJobStreamMock: { current: null as unknown },
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
        'flights.goproOverlayStarted': 'Overlay started',
        'flights.goproOverlayCancelled': 'Overlay cancelled',
        'flights.goproOverlayStartError': 'Overlay start error',
        'flights.goproOverlayCancelError': 'Overlay cancel error',
        'flights.goproOverlayNeedsVideo': 'Needs video',
        'flights.goproOverlayNeedsCameraVideo': 'Needs camera video',
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
  getApiErrorMessage: async (_error: unknown, fallback: string) => fallback,
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

vi.mock('../FlightVideoExportControls', () => ({
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

    await waitFor(() => {
      expect(createOverlayMock).toHaveBeenCalled();
    });
  });
});
