// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Flight } from '../../../types';
import { FlightYoutubeUploadControls } from './FlightYoutubeUploadControls';

const {
  cancelUpload,
  startUpload,
  toastError,
  toastSuccess,
  useCancelYoutubeUpload,
  useStartYoutubeUpload,
  useYoutubeAuthorizationUrl,
  useYoutubeStatus,
  useYoutubeUpload,
  useYoutubeVideoAssociations,
} = vi.hoisted(() => ({
  cancelUpload: vi.fn(),
  startUpload: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useCancelYoutubeUpload: vi.fn(),
  useStartYoutubeUpload: vi.fn(),
  useYoutubeAuthorizationUrl: vi.fn(),
  useYoutubeStatus: vi.fn(),
  useYoutubeUpload: vi.fn(),
  useYoutubeVideoAssociations: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { progress?: number }) => {
      const labels: Record<string, string> = {
        'flights.youtubeUploadStop': `Arrêter l'envoi (${values?.progress ?? 0} %)`,
        'flights.youtubeUploadStopTitle':
          "Arrêter l'envoi en cours vers YouTube",
        'flights.youtubeUploadCancelled': "L'envoi vers YouTube a été arrêté.",
        'flights.youtubeUpload': 'Publier sur YouTube',
        'flights.youtubeUploadConfirm': "Lancer l'envoi",
        'flights.youtubeUploadPublished': 'Déjà publiée',
      };
      return labels[key] ?? key;
    },
  }),
  withTranslation: () => (Component: unknown) => Component,
}));

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ error: toastError, success: toastSuccess }),
}));

vi.mock('../../../hooks/flights/useYoutubeUpload', () => ({
  useCancelYoutubeUpload,
  useStartYoutubeUpload,
  useYoutubeAuthorizationUrl,
  useYoutubeStatus,
  useYoutubeUpload,
  useYoutubeVideoAssociations,
  youtubeVideoAssociationsQueryKey: (flightId: string) => [
    'youtube-video-associations',
    flightId,
  ],
}));

describe('FlightYoutubeUploadControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancelUpload.mockResolvedValue({ status: 'cancelled' });
    startUpload.mockResolvedValue({ status: 'queued' });
    useYoutubeStatus.mockReturnValue({
      data: { configured: true, connected: true },
      isLoading: false,
    });
    useYoutubeUpload.mockReturnValue({
      data: {
        status: 'uploading',
        progress: 42,
        gopro_overlay_job_id: 'overlay-1080p',
      },
      isLoading: false,
    });
    useYoutubeVideoAssociations.mockReturnValue({ data: [] });
    useStartYoutubeUpload.mockReturnValue({
      mutateAsync: startUpload,
      isPending: false,
    });
    useCancelYoutubeUpload.mockReturnValue({
      mutateAsync: cancelUpload,
      isPending: false,
    });
    useYoutubeAuthorizationUrl.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('stops an active YouTube upload from the progress button', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const flight = {
      id: 'flight-1',
      flight_date: '2026-08-19',
      name: 'Vol test',
    } as Flight;

    render(
      <QueryClientProvider client={queryClient}>
        <FlightYoutubeUploadControls
          flight={flight}
          source={{
            source_type: 'gopro_overlay',
            gopro_overlay_job_id: 'overlay-1080p',
          }}
        />
      </QueryClientProvider>
    );

    fireEvent.click(
      screen.getByRole('button', { name: "Arrêter l'envoi (42 %)" })
    );

    await waitFor(() => expect(cancelUpload).toHaveBeenCalledOnce());
    expect(toastSuccess).toHaveBeenCalledWith(
      "L'envoi vers YouTube a été arrêté."
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it('starts an upload with the selected overlay job', async () => {
    useYoutubeUpload.mockReturnValue({ data: null, isLoading: false });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const flight = {
      id: 'flight-1',
      flight_date: '2026-08-19',
      name: 'Vol test',
    } as Flight;

    render(
      <QueryClientProvider client={queryClient}>
        <FlightYoutubeUploadControls
          flight={flight}
          source={{
            source_type: 'gopro_overlay',
            gopro_overlay_job_id: 'overlay-4k',
          }}
        />
      </QueryClientProvider>
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Publier sur YouTube' })
    );
    fireEvent.click(screen.getByRole('button', { name: "Lancer l'envoi" }));

    await waitFor(() =>
      expect(startUpload).toHaveBeenCalledWith({
        source_type: 'gopro_overlay',
        gopro_overlay_job_id: 'overlay-4k',
        title: 'Vol test',
        description: '',
        privacy_status: 'unlisted',
      })
    );
  });

  it('starts an upload from the panorama video', async () => {
    useYoutubeUpload.mockReturnValue({ data: null, isLoading: false });
    const queryClient = new QueryClient();
    const flight = {
      id: 'flight-1',
      flight_date: '2026-08-19',
      name: 'Vol test',
    } as Flight;

    render(
      <QueryClientProvider client={queryClient}>
        <FlightYoutubeUploadControls
          flight={flight}
          source={{ source_type: 'pano' }}
        />
      </QueryClientProvider>
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Publier sur YouTube' })
    );
    fireEvent.click(screen.getByRole('button', { name: "Lancer l'envoi" }));

    await waitFor(() =>
      expect(startUpload).toHaveBeenCalledWith({
        source_type: 'pano',
        title: 'Vol test pano',
        description: '',
        privacy_status: 'unlisted',
      })
    );
  });

  it('limits the default title to the YouTube maximum length', async () => {
    useYoutubeUpload.mockReturnValue({ data: null, isLoading: false });
    const queryClient = new QueryClient();
    const flight = {
      id: 'flight-1',
      flight_date: '2026-08-19',
      name: 'x'.repeat(120),
    } as Flight;

    render(
      <QueryClientProvider client={queryClient}>
        <FlightYoutubeUploadControls
          flight={flight}
          source={{
            source_type: 'gopro_overlay',
            gopro_overlay_job_id: 'overlay-4k',
          }}
        />
      </QueryClientProvider>
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Publier sur YouTube' })
    );
    fireEvent.click(screen.getByRole('button', { name: "Lancer l'envoi" }));

    await waitFor(() =>
      expect(startUpload).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'x'.repeat(100) })
      )
    );
  });

  it('disables a source whose uploaded video is still associated', () => {
    useYoutubeVideoAssociations.mockReturnValue({
      data: [
        {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          video_id: 'dQw4w9WgXcQ',
          can_delete_from_youtube: true,
          exists_on_youtube: true,
        },
      ],
    });
    useYoutubeUpload.mockReturnValue({
      data: {
        status: 'completed',
        youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      isLoading: false,
    });
    const queryClient = new QueryClient();
    const flight = {
      id: 'flight-1',
      flight_date: '2026-08-19',
      name: 'Vol test',
      youtube_urls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    } as Flight;

    render(
      <QueryClientProvider client={queryClient}>
        <FlightYoutubeUploadControls
          flight={flight}
          source={{ source_type: 'pano' }}
        />
      </QueryClientProvider>
    );

    expect(screen.getByRole('button', { name: 'Déjà publiée' })).toBeDisabled();
  });

  it('allows reupload when the associated video was deleted from YouTube', () => {
    useYoutubeUpload.mockReturnValue({
      data: {
        status: 'completed',
        youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      isLoading: false,
    });
    useYoutubeVideoAssociations.mockReturnValue({
      data: [
        {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          video_id: 'dQw4w9WgXcQ',
          can_delete_from_youtube: true,
          exists_on_youtube: false,
        },
      ],
    });
    const queryClient = new QueryClient();
    const flight = {
      id: 'flight-1',
      flight_date: '2026-08-19',
      name: 'Vol test',
      youtube_urls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    } as Flight;

    render(
      <QueryClientProvider client={queryClient}>
        <FlightYoutubeUploadControls
          flight={flight}
          source={{ source_type: 'pano' }}
        />
      </QueryClientProvider>
    );

    const button = screen.getByRole('button', {
      name: 'Publier sur YouTube',
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(
      screen.getByRole('button', { name: "Lancer l'envoi" })
    ).toBeInTheDocument();
  });

  it('refreshes YouTube associations when an upload completes', async () => {
    let status = 'uploading';
    useYoutubeUpload.mockImplementation(
      (_flightId: string, source?: { source_type: string }) => ({
        data: source ? { status, progress: 50 } : null,
        isLoading: false,
      })
    );
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const flight = {
      id: 'flight-1',
      flight_date: '2026-08-19',
      name: 'Vol test',
    } as Flight;
    const view = render(
      <QueryClientProvider client={queryClient}>
        <FlightYoutubeUploadControls
          flight={flight}
          source={{ source_type: 'pano' }}
        />
      </QueryClientProvider>
    );

    invalidateQueries.mockClear();
    status = 'completed';
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <FlightYoutubeUploadControls
          flight={flight}
          source={{ source_type: 'pano' }}
        />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['youtube-video-associations', flight.id],
      })
    );
  });
});
