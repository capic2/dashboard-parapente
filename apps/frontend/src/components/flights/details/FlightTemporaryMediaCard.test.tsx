import { fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('@dashboard-parapente/design-system', () => ({
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
    t: (key: string, options?: { progress?: number; title?: string }) => {
      const translations: Record<string, string> = {
        'flights.cameraBadge': 'Camera',
        'flights.panoBadge': 'Pano',
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
        'flights.temporarySourceDeleting': 'Deleting…',
        'common.cancel': 'Cancel',
        'flights.temporarySourceDeleted': 'Local file deleted',
        'flights.temporarySourceDeleteError': 'Unable to delete local file',
        'flights.cameraThumbnailAlt': 'Camera thumbnail',
        'flights.panoThumbnailAlt': 'Pano thumbnail',
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
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) =>
    Promise.resolve(fallback)
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

  it('shows a temporary source ready for YouTube without offering deletion', () => {
    render(<FlightTemporaryMediaCard flight={flight} sourceType="pano" />);

    expect(screen.getByText('Temporary file')).toBeInTheDocument();
    expect(screen.getByText('Ready to publish on YouTube')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Publish to YouTube' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete local file' })
    ).not.toBeInTheDocument();
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

  it('requires confirmation and keeps the YouTube video when deleting a published source', () => {
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

    expect(mutateAsyncMock).toHaveBeenCalledWith('pano');
  });
});
