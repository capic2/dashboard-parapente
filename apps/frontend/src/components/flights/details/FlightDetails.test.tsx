import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Flight, Site } from '../../../types';

const {
  apiDelete,
  confirmMock,
  createOverlayMock,
  generatePreviewMutateMock,
  generatePreviewMock,
  mockFlight,
  overlayJobStreamMock,
  previewMock,
  removeYoutubeAssociationMock,
  resetOverlayMock,
  updateFlightMock,
  videoStatusMock,
  youtubeUploadMock,
  youtubeAssociationsMock,
} = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  confirmMock: vi.fn(),
  createOverlayMock: vi.fn(),
  generatePreviewMutateMock: vi.fn(),
  generatePreviewMock: vi.fn(),
  resetOverlayMock: vi.fn(),
  updateFlightMock: vi.fn(),
  overlayJobStreamMock: { current: null as unknown },
  previewMock: { current: null as unknown },
  removeYoutubeAssociationMock: vi.fn(),
  videoStatusMock: { current: null as unknown },
  youtubeUploadMock: { current: null as unknown },
  youtubeAssociationsMock: { current: [] as unknown[] },
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

vi.mock('@dashboard-parapente/design-system', async () => {
  const React = await import('react');
  const MockTabsContext = React.createContext<{
    selectedKey: string;
    onSelectionChange: (key: string) => void;
  }>({
    selectedKey: 'infos',
    onSelectionChange: () => undefined,
  });

  return {
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
    Modal: ({
      children,
      isOpen,
      title,
    }: {
      children: React.ReactNode;
      isOpen: boolean;
      title: string;
    }) =>
      isOpen ? (
        <dialog open aria-label={title}>
          {children}
        </dialog>
      ) : null,
    Tab: ({ children, id }: { children: React.ReactNode; id: string }) => {
      const tabs = React.useContext(MockTabsContext);
      return (
        <button
          type="button"
          role="tab"
          aria-selected={tabs.selectedKey === id}
          onClick={() => tabs.onSelectionChange(id)}
        >
          {children}
        </button>
      );
    },
    TabList: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    TabPanel: ({ children, id }: { children: React.ReactNode; id: string }) => {
      const tabs = React.useContext(MockTabsContext);
      return tabs.selectedKey === id ? (
        <div role="tabpanel">{children}</div>
      ) : null;
    },
    Tabs: ({
      children,
      selectedKey,
      onSelectionChange,
    }: {
      children: React.ReactNode;
      selectedKey: string;
      onSelectionChange: (key: string) => void;
    }) => {
      const contextValue = React.useMemo(
        () => ({ selectedKey, onSelectionChange }),
        [selectedKey, onSelectionChange]
      );
      return (
        <MockTabsContext.Provider value={contextValue}>
          <div>{children}</div>
        </MockTabsContext.Provider>
      );
    },
  };
});

vi.mock('react-aria-components', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Label: ({
    children,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
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
        'flights.goproOverlayConfirmRegenerate': 'Confirm regenerate overlay',
        'flights.goproOverlayAdditionalResolution':
          'The existing overlay will be kept',
        'flights.goproOverlayRegenerate': 'Regenerate overlay',
        'flights.goproOverlayRegenerateShort': 'Regenerate overlay',
        'flights.goproOverlayGenerate': 'Generate overlay',
        'flights.goproOverlayGenerateShort': 'Generate overlay',
        'flights.goproOverlayOutputResolutionLabel': 'Output resolution',
        'flights.goproOverlayOutputResolutionAuto': 'Auto (video output)',
        'flights.goproOverlayOutputResolutionSource': 'Source resolution',
        'flights.goproOverlayOutputResolution1080p': '1080p (1920 × 1080)',
        'flights.goproOverlayOutputResolution4k': '4K (3840 × 2160)',
        'flights.goproOverlayOutputResolutionHint': 'Resolution hint',
        'flights.goproOverlayGpxOffsetLabel': 'GPX offset (seconds)',
        'flights.goproOverlayGpxOffsetHint': 'Offset hint',
        'common.reset': 'Reset',
        'flights.goproOverlayStarted': 'Overlay started',
        'flights.goproOverlayCancelled': 'Overlay cancelled',
        'flights.goproOverlayStartError': 'Overlay start error',
        'flights.goproOverlayCancelError': 'Overlay cancel error',
        'flights.goproOverlayDelete': 'Delete overlay',
        'flights.goproOverlayDeleting': 'Deleting overlay',
        'flights.goproOverlayConfirmDelete': 'Confirm delete overlay',
        'flights.goproOverlayDeleted': 'Overlay deleted',
        'flights.goproOverlayDeleteError': 'Overlay delete error',
        'flights.goproOverlayNeedsVideo': 'Needs video',
        'flights.goproOverlayNeedsCameraVideo': 'Needs camera video',
        'flights.trackFileLabel': 'GPX/IGC file',
        'flights.generationLogs.title': 'Generation logs',
        'flights.generationLogs.description': 'Media job tracking',
        'flights.generationLogs.videoTitle': 'Flight video',
        'flights.generationLogs.goproOverlayTitle': 'GoPro overlay',
        'flights.generationLogs.youtubeUploadTitle': 'YouTube upload',
        'flights.generationLogs.progress': 'Progress',
        'flights.generationLogs.error': 'Error',
        'flights.generationLogs.rawLogs': 'Raw logs',
        'flights.generationLogs.noLogs': 'No logs yet.',
        'flights.generationLogs.noRawLogs': 'No raw logs.',
        'flights.generationLogs.status.running': 'Running',
        'flights.generationLogs.status.encoding': 'Encoding',
        'flights.generationLogs.status.failed': 'Failed',
        'flights.generationLogs.status.uploading': 'Uploading',
        'flights.generationLogs.method.cpu': 'CPU',
        'flights.generationLogs.method.gpu': 'GPU',
        'flights.infoTab': 'Summary',
        'flights.replayTab': 'Media',
        'flights.logsTab': 'Processing',
        'flights.mediaPageTitle': 'Flight media',
        'flights.mediaReplayTitle': 'Flight replay',
        'flights.open3dReplay': 'Open 3D replay',
        'flights.mediaFilesTitle': 'Available files',
        'flights.mediaCreationTitle': 'Create and publish',
        'flights.youtubeVideos': 'YouTube videos',
        'flights.youtubeVideoTitle': 'Flight YouTube video',
        'flights.openOnYoutube': 'Open on YouTube',
        'flights.removeYoutubeAssociation': 'Remove association',
        'flights.youtubeAssociationRemoving': 'Removing association',
        'flights.youtubeAssociationRemoved': 'Association removed',
        'flights.youtubeAssociationRemoveError': 'Association removal error',
        'flights.youtubeRemovalDialogTitle': 'Remove YouTube video',
        'flights.youtubeRemovalManualDescription':
          'The video remains on YouTube.',
        'flights.youtubeRemovalOwnedDescription': 'Choose removal type.',
        'flights.youtubeRemovalPermanentWarning':
          'Permanent deletion cannot be undone.',
        'flights.youtubeRemovalDissociate': 'Dissociate only',
        'flights.youtubeRemovalDeletePermanently':
          'Delete permanently from YouTube',
        'common.cancel': 'Cancel',
      })[key] ?? key,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../../hooks/flights/useFlights', () => ({
  useUpdateFlight: () => ({ mutateAsync: updateFlightMock }),
  useUploadGPXToFlight: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock('../../../hooks/flights/useVideoExportStatus', () => ({
  useVideoExportStatus: () => ({ status: videoStatusMock.current }),
}));

vi.mock('../../../hooks/flights/useYoutubeUpload', () => ({
  useYoutubeUpload: () => ({ data: youtubeUploadMock.current }),
  useYoutubeVideoAssociations: () => ({
    data: youtubeAssociationsMock.current,
  }),
  useRemoveYoutubeVideoAssociation: () => ({
    isPending: false,
    mutateAsync: removeYoutubeAssociationMock,
  }),
}));

vi.mock('../../../hooks/gopro/useGoproOverlay', () => ({
  useCreateFlightGoproOverlayJob: () => ({
    data: null,
    isPending: false,
    mutateAsync: createOverlayMock,
    reset: resetOverlayMock,
  }),
  useGoproOverlayJobStream: () => ({ job: overlayJobStreamMock.current }),
  useGoproOverlayPreview: () => previewMock.current ?? { isPending: true },
  useGenerateGoproPreview: () => ({
    isPending: false,
    isError: false,
    mutate: generatePreviewMutateMock,
    mutateAsync: generatePreviewMock,
  }),
}));

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock('../../../lib/api', () => ({
  api: {
    delete: apiDelete,
  },
  getApiUrlWithSearchParams: () => '/api/camera.mp4',
  getApiErrorMessage: (_error: unknown, fallback: string) =>
    Promise.resolve(fallback),
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { token: string }) => unknown) =>
    selector({ token: 'test-token' }),
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

vi.mock('./FlightYoutubeUploadControls', () => ({
  FlightYoutubeUploadControls: ({
    goproOverlayJobId,
  }: {
    goproOverlayJobId: string;
  }) => <button type="button">YouTube upload {goproOverlayJobId}</button>,
}));

import { FlightDetails } from './FlightDetails';

const sites: Site[] = [];

const openTab = (name: 'Media' | 'Processing') => {
  fireEvent.click(screen.getByRole('tab', { name }));
};

describe('FlightDetails GoPro overlay action', () => {
  beforeEach(() => {
    apiDelete.mockReset();
    createOverlayMock.mockReset();
    updateFlightMock.mockReset();
    updateFlightMock.mockResolvedValue(mockFlight);
    generatePreviewMutateMock.mockReset();
    generatePreviewMock.mockReset();
    generatePreviewMock.mockResolvedValue({ status: 'generating' });
    createOverlayMock.mockResolvedValue({ job_id: 'job-new', job_token: null });
    confirmMock.mockReset();
    confirmMock.mockReturnValue(true);
    vi.stubGlobal('confirm', confirmMock);
    overlayJobStreamMock.current = null;
    previewMock.current = null;
    mockFlight.gopro_overlay_job_id = null;
    mockFlight.gopro_overlay_status = null;
    mockFlight.gopro_overlay_file_path = null;
    mockFlight.gopro_overlay_file_exists = undefined;
    mockFlight.gopro_overlay_progress = null;
    mockFlight.gopro_overlays = undefined;
    mockFlight.video_export_job_id = null;
    mockFlight.video_export_status = null;
    mockFlight.video_export_progress = null;
    mockFlight.video_file_path = '/exports/flight.mp4';
    mockFlight.video_file_exists = true;
    mockFlight.gopro_camera_file_exists = true;
    mockFlight.gpx_file_path = 'sample.gpx';
    mockFlight.youtube_urls = [];
    videoStatusMock.current = null;
    youtubeUploadMock.current = null;
    youtubeAssociationsMock.current = [];
    removeYoutubeAssociationMock.mockReset();
    removeYoutubeAssociationMock.mockResolvedValue(undefined);
  });

  it('shows only the stored track file name in flight information', () => {
    mockFlight.gpx_file_path = '/private/flights/20260315/01/watch.igc';

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    expect(screen.getByText('GPX/IGC file')).toBeInTheDocument();
    expect(screen.getByText('watch.igc')).toHaveAttribute('title', 'watch.igc');
    expect(
      screen.queryByText('/private/flights/20260315/01/watch.igc')
    ).not.toBeInTheDocument();
  });

  it('does not show track file information when no track is stored', () => {
    mockFlight.gpx_file_path = null;

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    expect(screen.queryByText('GPX/IGC file')).not.toBeInTheDocument();
  });

  it('embeds every YouTube video attached to the flight', () => {
    mockFlight.youtube_urls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/9bZkp7q19f0',
    ];

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    const players = screen.getAllByTitle('Flight YouTube video');
    expect(players).toHaveLength(2);
    expect(players[0]).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    );
    expect(players[0]).not.toHaveAttribute('sandbox');
    expect(players[1]).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/9bZkp7q19f0'
    );
    expect(
      screen.getByRole('button', { name: 'Open 3D replay' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('flights.loading3dViewer')
    ).not.toBeInTheDocument();
  });

  it('dissociates a manual YouTube link without offering remote deletion', async () => {
    const removedUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const remainingUrl = 'https://youtu.be/9bZkp7q19f0';
    mockFlight.youtube_urls = [removedUrl, remainingUrl];
    youtubeAssociationsMock.current = [
      {
        url: removedUrl,
        video_id: 'manual-video',
        can_delete_from_youtube: false,
      },
      {
        url: remainingUrl,
        video_id: 'remaining-video',
        can_delete_from_youtube: false,
      },
    ];

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Remove association' })[0]
    );

    expect(
      screen.getByRole('dialog', { name: 'Remove YouTube video' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Delete permanently from YouTube',
      })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dissociate only' }));

    await waitFor(() =>
      expect(removeYoutubeAssociationMock).toHaveBeenCalledWith({
        videoId: 'manual-video',
        deleteFromYoutube: false,
      })
    );
    expect(updateFlightMock).not.toHaveBeenCalled();
  });

  it('offers permanent deletion for an app-uploaded YouTube video', async () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    mockFlight.youtube_urls = [url];
    youtubeAssociationsMock.current = [
      {
        url,
        video_id: 'owned-video',
        can_delete_from_youtube: true,
      },
    ];

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );
    openTab('Media');
    fireEvent.click(screen.getByRole('button', { name: 'Remove association' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Delete permanently from YouTube',
      })
    );

    await waitFor(() =>
      expect(removeYoutubeAssociationMock).toHaveBeenCalledWith({
        videoId: 'owned-video',
        deleteFromYoutube: true,
      })
    );
  });

  it('cancels YouTube removal without mutating', () => {
    const url = 'https://youtu.be/9bZkp7q19f0';
    mockFlight.youtube_urls = [url];
    youtubeAssociationsMock.current = [
      {
        url,
        video_id: 'manual-video',
        can_delete_from_youtube: false,
      },
    ];

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );
    openTab('Media');
    fireEvent.click(screen.getByRole('button', { name: 'Remove association' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(removeYoutubeAssociationMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('dialog', { name: 'Remove YouTube video' })
    ).not.toBeInTheDocument();
  });

  it('keeps the YouTube association and modal visible on removal failure', async () => {
    const url = 'https://youtu.be/9bZkp7q19f0';
    mockFlight.youtube_urls = [url];
    youtubeAssociationsMock.current = [
      {
        url,
        video_id: 'manual-video',
        can_delete_from_youtube: false,
      },
    ];
    removeYoutubeAssociationMock.mockRejectedValue(new Error('API failed'));

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );
    openTab('Media');
    fireEvent.click(screen.getByRole('button', { name: 'Remove association' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dissociate only' }));

    await waitFor(() =>
      expect(removeYoutubeAssociationMock).toHaveBeenCalled()
    );
    expect(
      screen.getByRole('dialog', { name: 'Remove YouTube video' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove association' })
    ).toBeInTheDocument();
  });

  it('organizes media into replay, available files, and creation sections', () => {
    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    expect(
      screen.getByRole('heading', { name: 'Flight media' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Flight replay' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Available files' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Create and publish' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'flights.downloadGpx' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'flights.viewer.downloadVideo',
      })
    ).toBeInTheDocument();
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

    openTab('Media');

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

    openTab('Media');

    fireEvent.click(screen.getByRole('button', { name: /Cancel overlay/u }));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith(
        'gopro-overlays/jobs/job-overlay/cancel',
        { searchParams: undefined }
      );
    });
  });

  it('passes the GPX offset when starting overlay generation', async () => {
    previewMock.current = {
      isPending: false,
      data: {
        video: {
          duration_seconds: 60,
          start_time: '2026-03-15T14:00:00Z',
          preview_target_end_seconds: 60,
          preview_segments: [
            {
              preview_start_seconds: 0,
              source_start_seconds: 0,
              duration_seconds: 60,
            },
          ],
          preview_status: 'ready',
          preview_available_duration_seconds: 60,
          preview_requested_duration_seconds: 60,
          preview_max_duration_seconds: 180,
        },
        gpx: {
          start_time: '2026-03-15T14:00:00Z',
          end_time: '2026-03-15T14:01:00Z',
          duration_seconds: 60,
          coordinates: [
            {
              lat: 45.0,
              lon: 6.0,
              elevation: 1000,
              speedKmh: 35,
              time: '2026-03-15T14:00:00Z',
            },
          ],
        },
        alignment: {
          automatic_offset_seconds: 8,
          manual_offset_seconds: 0,
          effective_offset_seconds: 8,
        },
      },
    };

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    fireEvent.click(screen.getByRole('button', { name: /Generate overlay/u }));

    expect(
      screen.getByRole('dialog', {
        name: 'flights.goproOverlayGenerateTitle',
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('GPX offset (seconds)')).toHaveValue(0);
    expect(screen.getByLabelText('Output resolution')).toHaveValue('auto');

    fireEvent.change(screen.getByLabelText('GPX offset (seconds)'), {
      target: { value: '2.5' },
    });
    fireEvent.change(screen.getByLabelText('Output resolution'), {
      target: { value: '4k' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'flights.goproOverlayLaunch' })
    );

    await waitFor(() => {
      expect(createOverlayMock).toHaveBeenCalled();
    });
    const formData = createOverlayMock.mock.calls[0][0] as FormData;
    expect(formData.get('gpx_offset')).toBe('2.5');
    expect(formData.get('output_resolution')).toBe('4k');
  });

  it('keeps the automatic alignment separate from the manual GPX offset', () => {
    previewMock.current = {
      isPending: false,
      data: {
        video: {
          duration_seconds: 60,
          start_time: '2026-03-15T14:00:00Z',
          preview_target_end_seconds: 60,
          preview_segments: [
            {
              preview_start_seconds: 0,
              source_start_seconds: 0,
              duration_seconds: 60,
            },
          ],
          preview_status: 'ready',
          preview_available_duration_seconds: 60,
          preview_requested_duration_seconds: 60,
          preview_max_duration_seconds: 180,
        },
        gpx: {
          start_time: '2026-03-15T14:00:00Z',
          end_time: '2026-03-15T14:01:00Z',
          duration_seconds: 60,
          coordinates: [
            {
              lat: 45.0,
              lon: 6.0,
              elevation: 1000,
              speedKmh: 35,
              time: '2026-03-15T14:00:00Z',
            },
          ],
        },
        alignment: {
          automatic_offset_seconds: 8,
          manual_offset_seconds: 0,
          effective_offset_seconds: 8,
        },
      },
    };

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    fireEvent.click(screen.getByRole('button', { name: /Generate overlay/u }));

    expect(screen.getByLabelText('GPX offset (seconds)')).toHaveValue(0);
  });

  it('requests a longer low-resolution preview from the duration slider', async () => {
    previewMock.current = {
      isPending: false,
      data: {
        video: {
          duration_seconds: 1200,
          start_time: '2026-03-15T14:00:00Z',
          preview_target_end_seconds: 1200,
          preview_segments: [
            {
              preview_start_seconds: 0,
              source_start_seconds: 0,
              duration_seconds: 180,
            },
            {
              preview_start_seconds: 180,
              source_start_seconds: 1020,
              duration_seconds: 180,
            },
          ],
          preview_status: 'ready',
          preview_available_duration_seconds: 180,
          preview_requested_duration_seconds: 180,
          preview_max_duration_seconds: 601,
        },
        gpx: {
          start_time: '2026-03-15T14:00:00Z',
          end_time: '2026-03-15T14:20:00Z',
          duration_seconds: 1200,
          coordinates: [],
        },
        alignment: {
          automatic_offset_seconds: 0,
          manual_offset_seconds: 0,
          effective_offset_seconds: 0,
        },
      },
    };

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );
    openTab('Media');
    fireEvent.click(screen.getByRole('button', { name: /Generate overlay/u }));
    const durationSlider = screen.getByLabelText(
      'flights.goproPreviewDuration'
    );
    expect(durationSlider).toHaveAttribute('max', '10');
    fireEvent.change(durationSlider, {
      target: { value: '8' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'flights.goproPreviewGenerate' })
    );

    await waitFor(() =>
      expect(generatePreviewMock).toHaveBeenCalledWith({
        durationSeconds: 480,
        targetEndSeconds: 1200,
      })
    );
  }, 10_000);

  it('requests the default start and end preview when no matching cache exists', async () => {
    previewMock.current = {
      isPending: false,
      data: {
        video: {
          duration_seconds: 1200,
          start_time: '2026-03-15T14:00:00Z',
          preview_target_end_seconds: 1100,
          preview_segments: [
            {
              preview_start_seconds: 0,
              source_start_seconds: 0,
              duration_seconds: 1200,
            },
          ],
          preview_status: 'missing',
          preview_available_duration_seconds: 0,
          preview_requested_duration_seconds: 180,
          preview_max_duration_seconds: 900,
        },
        gpx: {
          start_time: '2026-03-15T14:00:00Z',
          end_time: '2026-03-15T14:18:20Z',
          duration_seconds: 1100,
          coordinates: [],
        },
        alignment: {
          automatic_offset_seconds: 0,
          manual_offset_seconds: 0,
          effective_offset_seconds: 0,
        },
      },
    };

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );
    openTab('Media');
    fireEvent.click(screen.getByRole('button', { name: /Generate overlay/u }));

    await waitFor(() =>
      expect(generatePreviewMutateMock).toHaveBeenCalledWith(
        { durationSeconds: 180, targetEndSeconds: 1100 },
        expect.objectContaining({ onSuccess: expect.any(Function) })
      )
    );
  });

  it('shows a notice while the low-resolution preview is generating', () => {
    previewMock.current = {
      isPending: false,
      data: {
        video: {
          duration_seconds: 1200,
          start_time: '2026-03-15T14:00:00Z',
          preview_target_end_seconds: 1200,
          preview_segments: [
            {
              preview_start_seconds: 0,
              source_start_seconds: 0,
              duration_seconds: 180,
            },
            {
              preview_start_seconds: 180,
              source_start_seconds: 1020,
              duration_seconds: 180,
            },
          ],
          preview_status: 'generating',
          preview_available_duration_seconds: 180,
          preview_requested_duration_seconds: 180,
          preview_max_duration_seconds: 601,
        },
        gpx: {
          start_time: '2026-03-15T14:00:00Z',
          end_time: '2026-03-15T14:20:00Z',
          duration_seconds: 1200,
          coordinates: [],
        },
        alignment: {
          automatic_offset_seconds: 0,
          manual_offset_seconds: 0,
          effective_offset_seconds: 0,
        },
      },
    };

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    fireEvent.click(screen.getByRole('button', { name: /Generate overlay/u }));

    expect(
      screen.getByText('flights.goproPreviewGeneratingNotice')
    ).toBeInTheDocument();
  });

  it('resets the manual GPX offset without applying automatic alignment', async () => {
    previewMock.current = {
      isPending: false,
      data: {
        video: {
          duration_seconds: 60,
          start_time: '2026-03-15T14:00:00Z',
          preview_target_end_seconds: 60,
          preview_segments: [
            {
              preview_start_seconds: 0,
              source_start_seconds: 0,
              duration_seconds: 60,
            },
          ],
          preview_status: 'ready',
          preview_available_duration_seconds: 60,
          preview_requested_duration_seconds: 60,
          preview_max_duration_seconds: 180,
        },
        gpx: {
          start_time: '2026-03-15T14:00:00Z',
          end_time: '2026-03-15T14:01:00Z',
          duration_seconds: 60,
          coordinates: [
            {
              lat: 45.0,
              lon: 6.0,
              elevation: 1000,
              speedKmh: 35,
              time: '2026-03-15T14:00:00Z',
            },
          ],
        },
        alignment: {
          automatic_offset_seconds: 8,
          manual_offset_seconds: 0,
          effective_offset_seconds: 8,
        },
      },
    };

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    fireEvent.click(screen.getByRole('button', { name: /Generate overlay/u }));

    const offsetInput = screen.getByLabelText('GPX offset (seconds)');
    await waitFor(() => {
      expect(offsetInput).toHaveValue(0);
    });

    fireEvent.change(offsetInput, { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(offsetInput).toHaveValue(0);
  });

  it('shows video and GoPro job details in the logs tab', () => {
    mockFlight.video_export_job_id = 'video-job';
    mockFlight.video_export_status = 'running';
    overlayJobStreamMock.current = {
      job_id: 'overlay-job',
      status: 'failed',
      progress: 43,
      message: 'Rendering overlay',
      error: 'Overlay failed on frame 42',
      render_method: 'gpu',
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
      render_method: 'cpu',
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

    expect(screen.queryByText('Generation logs')).not.toBeInTheDocument();

    openTab('Processing');

    expect(screen.getByText('Generation logs')).toBeInTheDocument();
    const videoToggle = screen.getByRole('button', {
      name: /Flight video/u,
    });
    const overlayToggle = screen.getByRole('button', {
      name: /GoPro overlay/u,
    });

    expect(videoToggle).toHaveAttribute('aria-expanded', 'true');
    expect(overlayToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByText('CPU').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GPU').length).toBeGreaterThan(0);
    expect(screen.getByText('Encoding with FFmpeg')).toBeInTheDocument();
    expect(
      screen.queryByText('Overlay failed on frame 42')
    ).not.toBeInTheDocument();

    fireEvent.click(overlayToggle);

    expect(screen.getByText('Overlay failed on frame 42')).toBeInTheDocument();
    expect(screen.getAllByText(/Frame 42 failed/u).length).toBeGreaterThan(0);

    fireEvent.click(videoToggle);

    expect(screen.queryByText('Encoding with FFmpeg')).not.toBeInTheDocument();
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
    expect(
      screen.queryByRole('tab', { name: 'Processing' })
    ).not.toBeInTheDocument();
    openTab('Media');
    expect(
      screen.getByRole('button', { name: 'Video action' })
    ).toBeInTheDocument();
  });

  it('keeps the logs tab available while a job status is loading', () => {
    mockFlight.video_export_job_id = 'video-job';

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Processing');

    expect(screen.getByText('Generation logs')).toBeInTheDocument();
    const videoToggle = screen.getByRole('button', {
      name: 'Flight video',
    });
    expect(videoToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('No logs yet.')).not.toBeInTheDocument();

    fireEvent.click(videoToggle);

    expect(screen.getByText('No logs yet.')).toBeInTheDocument();
  });

  it('opens GoPro logs by default while the overlay job is running', () => {
    overlayJobStreamMock.current = {
      job_id: 'overlay-job',
      status: 'running',
      progress: 43,
      message: 'Rendering overlay',
      error: null,
      render_method: 'cpu',
      layout_id: 'layout',
      layout_label: 'Parapente',
      output_filename: 'final.mp4',
      created_at: '2026-03-15T14:00:00Z',
      updated_at: '2026-03-15T14:10:00Z',
      log_tail: ['Starting overlay'],
    };

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Processing');

    expect(
      screen.getByRole('button', { name: /GoPro overlay/u })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Rendering overlay')).toBeInTheDocument();
  });

  it('shows YouTube upload logs in the processing tab', () => {
    youtubeUploadMock.current = {
      job_id: 'youtube-job',
      flight_id: mockFlight.id,
      status: 'uploading',
      progress: 42,
      youtube_url: null,
      error: null,
      log_tail: ['YouTube upload queued', 'YouTube upload progress: 42%'],
    };

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Processing');

    expect(
      screen.getByRole('button', { name: /YouTube upload/u })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getAllByText(/YouTube upload progress: 42%/u).length
    ).toBeGreaterThan(0);
  });

  it('preserves a manual toggle while a fallback-only job changes status', () => {
    mockFlight.video_export_status = 'running';

    const view = render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Processing');
    const videoToggle = screen.getByRole('button', {
      name: /Flight video/u,
    });
    fireEvent.click(videoToggle);
    expect(videoToggle).toHaveAttribute('aria-expanded', 'false');

    mockFlight.video_export_status = 'encoding';
    view.rerender(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    expect(videoToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('regenerates overlay after cancellation', () => {
    mockFlight.gopro_overlay_job_id = 'job-overlay';
    mockFlight.gopro_overlay_status = 'cancelled';

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    fireEvent.click(
      screen.getByRole('button', { name: /Regenerate overlay/u })
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'flights.goproOverlayLaunch' })
    );

    expect(createOverlayMock).toHaveBeenCalled();
  });

  it('shows every persisted overlay resolution', () => {
    const baseOverlay = {
      flight_id: mockFlight.id,
      status: 'completed' as const,
      progress: 100,
      message: 'Overlay ready',
      layout_id: 'parapente',
      layout_label: 'Parapente',
      gpx_offset: 0,
      created_at: '2026-03-15T12:00:00Z',
      updated_at: '2026-03-15T12:00:00Z',
      completed_at: '2026-03-15T12:00:00Z',
      log_tail: [],
    };
    mockFlight.gopro_overlays = [
      {
        ...baseOverlay,
        job_id: 'overlay-4k',
        output_filename: 'test-flight-4k.mp4',
        video_width: 3840,
        video_height: 2160,
      },
      {
        ...baseOverlay,
        job_id: 'overlay-1080p',
        output_filename: 'test-flight-1080p.mp4',
        video_width: 1920,
        video_height: 1080,
      },
    ];

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    expect(screen.getByText('test-flight-4k.mp4')).toBeInTheDocument();
    expect(screen.getByText('test-flight-1080p.mp4')).toBeInTheDocument();
    expect(screen.getByText('3840 × 2160')).toBeInTheDocument();
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'YouTube upload overlay-4k' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'YouTube upload overlay-1080p' })
    ).toBeInTheDocument();
  });

  it('deletes an overlay and removes its card', async () => {
    apiDelete.mockResolvedValue({ deleted: true });
    mockFlight.gopro_overlays = [
      {
        flight_id: mockFlight.id,
        job_id: 'overlay-4k',
        status: 'completed',
        progress: 100,
        message: 'Overlay ready',
        layout_id: 'parapente',
        layout_label: 'Parapente',
        output_filename: 'test-flight-4k.mp4',
        video_width: 3840,
        video_height: 2160,
        gpx_offset: 0,
        created_at: '2026-03-15T12:00:00Z',
        updated_at: '2026-03-15T12:00:00Z',
        completed_at: '2026-03-15T12:00:00Z',
        log_tail: [],
      },
    ];

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    fireEvent.click(screen.getByRole('button', { name: 'Delete overlay' }));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith('gopro-overlays/jobs/overlay-4k');
      expect(screen.queryByText('test-flight-4k.mp4')).not.toBeInTheDocument();
    });
    expect(confirmMock).toHaveBeenCalledWith('Confirm delete overlay');
  });

  it('regenerates an existing overlay after confirmation', () => {
    mockFlight.gopro_overlay_job_id = 'job-overlay';
    mockFlight.gopro_overlay_status = 'completed';
    mockFlight.gopro_overlay_file_path = '/exports/final.mp4';
    mockFlight.gopro_overlay_file_exists = true;

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    fireEvent.click(
      screen.getByRole('button', { name: /Regenerate overlay/u })
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'flights.goproOverlayLaunch' })
    );

    expect(createOverlayMock).toHaveBeenCalled();
  });

  it('keeps an existing overlay when regeneration is not confirmed', () => {
    mockFlight.gopro_overlay_job_id = 'job-overlay';
    mockFlight.gopro_overlay_status = 'completed';
    mockFlight.gopro_overlay_file_path = '/exports/final.mp4';
    mockFlight.gopro_overlay_file_exists = true;

    render(
      <FlightDetails
        flight={mockFlight}
        sites={sites}
        onShowCreateSiteModal={() => undefined}
      />
    );

    openTab('Media');

    fireEvent.click(
      screen.getByRole('button', { name: /Regenerate overlay/u })
    );

    expect(createOverlayMock).not.toHaveBeenCalled();
  });
});
