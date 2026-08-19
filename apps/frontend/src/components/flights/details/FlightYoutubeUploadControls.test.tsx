// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Flight } from '../../../types';
import { FlightYoutubeUploadControls } from './FlightYoutubeUploadControls';

const {
  cancelUpload,
  toastError,
  toastSuccess,
  useCancelYoutubeUpload,
  useStartYoutubeUpload,
  useYoutubeAuthorizationUrl,
  useYoutubeStatus,
  useYoutubeUpload,
} = vi.hoisted(() => ({
  cancelUpload: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useCancelYoutubeUpload: vi.fn(),
  useStartYoutubeUpload: vi.fn(),
  useYoutubeAuthorizationUrl: vi.fn(),
  useYoutubeStatus: vi.fn(),
  useYoutubeUpload: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { progress?: number }) => {
      const labels: Record<string, string> = {
        'flights.youtubeUploadStop': `Arrêter l'envoi (${values?.progress ?? 0} %)`,
        'flights.youtubeUploadStopTitle':
          "Arrêter l'envoi en cours vers YouTube",
        'flights.youtubeUploadCancelled': "L'envoi vers YouTube a été arrêté.",
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
}));

describe('FlightYoutubeUploadControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancelUpload.mockResolvedValue({ status: 'cancelled' });
    useYoutubeStatus.mockReturnValue({
      data: { configured: true, connected: true },
      isLoading: false,
    });
    useYoutubeUpload.mockReturnValue({
      data: { status: 'uploading', progress: 42 },
      isLoading: false,
    });
    useStartYoutubeUpload.mockReturnValue({
      mutateAsync: vi.fn(),
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
        <FlightYoutubeUploadControls flight={flight} />
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
});
