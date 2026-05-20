import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Flight } from '@dashboard-parapente/shared-types';

const { apiDelete, apiPost, exportStatusMock, mockFlight } = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  apiPost: vi.fn(),
  exportStatusMock: { current: null as unknown },
  mockFlight: {
    id: 'flight-1',
    flight_date: '2026-03-15',
    title: 'Test flight',
    gpx_file_path: 'sample.gpx',
    video_export_status: null as string | null,
    video_export_job_id: null as string | null,
    video_file_path: null as string | null,
  } as Flight,
}));

vi.mock('@dashboard-parapente/design-system', () => ({
  Button: ({
    children,
    isDisabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isDisabled?: boolean;
  }) => (
    <button type="button" disabled={isDisabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'flights.viewer.videoExportMode': 'Export mode',
        'flights.viewer.videoModeManualFast': 'Fast smooth',
        'flights.viewer.videoModeManual': 'Max quality',
        'flights.viewer.videoModeManualFastHint': 'Fast hint',
        'flights.viewer.videoModeManualHint': 'Manual hint',
        'flights.viewer.generateVideo': 'Generate video',
        'flights.viewer.generateVideoShort': 'Generate video',
        'flights.viewer.resumeVideo': 'Resume generation',
        'flights.viewer.resumeVideoShort': 'Resume generation',
        'flights.viewer.videoResumeHint': 'frames preserved',
        'flights.viewer.videoGenerating': 'Generating video',
        'flights.viewer.videoGeneratingShort': 'Video in progress',
        'flights.viewer.cancelGeneration': 'Cancel generation',
        'flights.viewer.cancelGenerationShort': 'Cancel generation',
        'flights.viewer.regenerateVideo': 'Restart generation',
        'flights.viewer.regenerateVideoShort': 'Regenerate video',
      })[key] ?? key,
  }),
}));

vi.mock('../../hooks/flights/useFlight', () => ({
  useFlight: () => ({ data: mockFlight }),
}));

vi.mock('../../hooks/flights/useVideoExportStatus', () => ({
  useVideoExportStatus: () => ({ status: exportStatusMock.current }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    delete: apiDelete,
    post: apiPost,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

import { FlightVideoExportControls } from './FlightVideoExportControls';

describe('FlightVideoExportControls', () => {
  beforeEach(() => {
    apiDelete.mockReset();
    apiPost.mockReset();
    apiPost.mockReturnValue({ json: vi.fn().mockResolvedValue({}) });
    mockFlight.video_export_status = null;
    mockFlight.video_export_job_id = null;
    mockFlight.video_file_path = null;
    mockFlight.video_file_exists = undefined;
    exportStatusMock.current = null;
  });

  it('starts fast smooth export by default', async () => {
    render(<FlightVideoExportControls flight={mockFlight} />);

    expect(screen.getByText('Fast hint')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Generate video/u }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('flights/flight-1/export-video', {
        searchParams: { mode: 'manual_fast' },
      });
    });
  });

  it('starts max quality export after switching mode', async () => {
    render(<FlightVideoExportControls flight={mockFlight} />);

    fireEvent.click(screen.getByRole('radio', { name: /Max quality/u }));

    expect(screen.getByText('Manual hint')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Generate video/u }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('flights/flight-1/export-video', {
        searchParams: { mode: 'manual' },
      });
    });
  });

  it('resumes a cancelled export when preserved frames are available', async () => {
    mockFlight.video_export_status = 'cancelled';
    mockFlight.video_export_job_id = 'job-cancelled';
    exportStatusMock.current = {
      job_id: 'job-cancelled',
      status: 'failed',
      internal_status: 'cancelled',
      can_resume: true,
      frames_captured: 25,
      resume_from_frame: 25,
    };

    render(<FlightVideoExportControls flight={mockFlight} />);

    expect(screen.getByText('frames preserved')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Resume generation/u }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('exports/job-cancelled/resume');
    });
  });

  it('does not show the download button for completed videos', () => {
    mockFlight.video_export_status = 'completed';
    mockFlight.video_export_job_id = 'job-video';
    mockFlight.video_file_path = '/exports/job-video.mp4';
    mockFlight.video_file_exists = true;

    render(<FlightVideoExportControls flight={mockFlight} />);

    expect(
      screen.queryByRole('button', { name: /Download video/u })
    ).not.toBeInTheDocument();
  });

  it('generates again when database references a missing completed video file', () => {
    mockFlight.video_export_status = 'completed';
    mockFlight.video_export_job_id = 'job-video';
    mockFlight.video_file_path = '/exports/missing.mp4';
    mockFlight.video_file_exists = false;

    render(<FlightVideoExportControls flight={mockFlight} compact />);

    expect(
      screen.getByRole('button', { name: /Generate video/u })
    ).toBeEnabled();
  });
});
