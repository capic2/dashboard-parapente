import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Flight } from '../../../types';

const { publicationMock, mutateAsyncMock, toastSuccessMock, toastErrorMock } =
  vi.hoisted(() => ({
    publicationMock: {
      upload: { data: null as unknown },
      isPublished: false,
    },
    mutateAsyncMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }));

vi.mock('@dashboard-parapente/core/Button/Button', () => ({
  Button: ({
    children,
    isDisabled,
    onPress,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isDisabled?: boolean;
    onPress?: () => void;
    variant?: string;
  }) => (
    <button type="button" disabled={isDisabled} onClick={onPress} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@dashboard-parapente/core/Modal', () => ({
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
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: { progress?: number; title?: string; role?: string }
    ) => {
      const translations: Record<string, string> = {
        'flights.cameraBadge': 'Camera',
        'flights.panoBadge': 'Pano',
        'flights.faceBadge': 'Face',
        'flights.piloteBadge': 'Pilot',
        'flights.temporarySourceBadge': 'Temporary file',
        'flights.temporarySourceReady': 'Ready to publish on YouTube',
        'flights.temporarySourcePublished': 'Publication confirmed on YouTube',
        'flights.temporarySourceUploading': `Uploading to YouTube · ${options?.progress ?? 0}%`,
        'flights.temporarySourceFailed': 'YouTube upload failed',
        'flights.temporarySourceDelete': 'Delete local file',
        'flights.temporarySourceDeleteTitle': 'Delete local source',
        'flights.temporarySourceDeleteDescription': `Delete the local ${options?.title ?? ''} file?`,
        'flights.temporarySourceDeleteYoutubeNote':
          'The video stays on YouTube.',
        'flights.temporarySourceDeleteLocalNote':
          'Only the local file will be deleted.',
        'flights.temporarySourceDeleting': 'Deleting…',
        'common.cancel': 'Cancel',
        'flights.temporarySourceDeleted': 'Local file deleted',
        'flights.temporarySourceDeleteError': 'Unable to delete local file',
        'flights.temporarySourceDeleteConflict':
          'Deletion blocked by YouTube publication safety.',
        'flights.cameraThumbnailAlt': 'Camera thumbnail',
        'flights.panoThumbnailAlt': 'Pano thumbnail',
        'flights.temporaryVideoThumbnailAlt': `${options?.role ?? ''} video thumbnail`,
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../../../hooks/flights/useYoutubeUpload', () => ({
  useYoutubeSourcePublicationStatus: () => publicationMock,
  useDeleteFlightTemporaryMedia: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
}));

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ success: toastSuccessMock, error: toastErrorMock }),
}));

vi.mock('../../../lib/api', () => ({
  getApiErrorMessage: vi.fn(
    (
      error: unknown,
      fallback: string,
      statusMessages?: Partial<
        Record<number, { message: string; details: readonly string[] }>
      >
    ) => {
      const status =
        error instanceof Error &&
        'response' in error &&
        error.response instanceof Response
          ? error.response.status
          : undefined;
      return Promise.resolve(
        (status === undefined
          ? undefined
          : statusMessages?.[status]?.message) ?? fallback
      );
    }
  ),
}));

vi.mock('./FlightMediaThumbnail', () => ({
  FlightMediaThumbnail: () => <div data-testid="temporary-source-thumbnail" />,
}));

vi.mock('./FlightYoutubeUploadControls', () => ({
  FlightYoutubeUploadControls: () => <button>Publish to YouTube</button>,
}));

import { FlightTemporaryMediaCard } from './FlightTemporaryMediaCard';

const flight = {
  id: 'flight-1',
  title: 'Test flight',
  flight_date: '2026-03-15',
  youtube_urls: [],
} as unknown as Flight;

describe('FlightTemporaryMediaCard', () => {
  beforeEach(() => {
    publicationMock.upload = { data: null };
    publicationMock.isPublished = false;
    mutateAsyncMock.mockReset().mockResolvedValue(undefined);
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('shows the source role, ready state, YouTube action, and local deletion', () => {
    render(<FlightTemporaryMediaCard flight={flight} sourceType="pano" />);

    expect(screen.getByRole('heading', { name: 'Pano' })).toBeInTheDocument();
    expect(screen.getByText('Ready to publish on YouTube')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Publish to YouTube' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete local file' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete local file' }));
    expect(
      screen.getByText('Only the local file will be deleted.')
    ).toBeInTheDocument();
  });

  it('shows upload progress and failure as text statuses', () => {
    publicationMock.upload = {
      data: { status: 'uploading', progress: 42 },
    };
    const { rerender } = render(
      <FlightTemporaryMediaCard flight={flight} sourceType="camera" />
    );
    expect(screen.getByText('Uploading to YouTube · 42%')).toBeInTheDocument();

    publicationMock.upload = { data: { status: 'failed' } };
    rerender(<FlightTemporaryMediaCard flight={flight} sourceType="camera" />);
    expect(screen.getByText('YouTube upload failed')).toBeInTheDocument();
  });

  it('shows the upload failure reason inline', () => {
    publicationMock.upload = {
      data: { status: 'failed', error: 'YouTube quota exceeded' },
    };

    render(<FlightTemporaryMediaCard flight={flight} sourceType="face" />);

    expect(screen.getByText('YouTube quota exceeded')).toBeInTheDocument();
  });

  it.each([
    ['face', 'Face'],
    ['pilote', 'Pilot'],
  ] as const)('labels the %s source with its role', (sourceType, title) => {
    render(
      <FlightTemporaryMediaCard flight={flight} sourceType={sourceType} />
    );

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('requires confirmation and keeps the YouTube video when deleting a published source', async () => {
    publicationMock.isPublished = true;
    render(<FlightTemporaryMediaCard flight={flight} sourceType="pano" />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete local file' }));
    expect(
      screen.getByRole('dialog', { name: 'Delete local source' })
    ).toBeInTheDocument();
    expect(screen.getByText('The video stays on YouTube.')).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button', {
      name: 'Delete local file',
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledWith('pano'));
  });

  it('explains when YouTube safety blocks local deletion', async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      Object.assign(new Error('Conflict'), {
        response: new Response(null, { status: 409 }),
      })
    );
    render(
      <FlightTemporaryMediaCard
        flight={flight}
        sourceType="youtube_telemetry"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete local file' }));
    const deleteButtons = screen.getAllByRole('button', {
      name: 'Delete local file',
    });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Deletion blocked by YouTube publication safety.'
      )
    );
  });
});
