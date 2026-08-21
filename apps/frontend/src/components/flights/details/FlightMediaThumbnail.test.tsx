import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FlightMediaThumbnail } from './FlightMediaThumbnail';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@dashboard-parapente/design-system', () => ({
  Lightbox: ({
    isOpen,
    images,
  }: {
    isOpen: boolean;
    images: { alt: string }[];
  }) => (isOpen ? <dialog open>{images[0].alt}</dialog> : null),
}));

vi.mock('../../../lib/api', () => ({
  api: { get: apiGet },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      key === 'flights.openMediaThumbnail' ? `Enlarge ${values?.name}` : key,
  }),
}));

describe('FlightMediaThumbnail', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockReturnValue({ blob: () => Promise.resolve(new Blob(['jpeg'])) });
    Object.defineProperties(URL, {
      createObjectURL: {
        configurable: true,
        value: vi.fn(() => 'blob:thumbnail'),
      },
      revokeObjectURL: {
        configurable: true,
        value: vi.fn(),
      },
    });
  });

  const renderThumbnail = (component: ReactNode) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(component, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });
  };

  it('loads the image through the authenticated API and opens the lightbox', async () => {
    renderThumbnail(
      <FlightMediaThumbnail
        path="/flights/flight-1/video/thumbnail"
        alt="Flight video thumbnail"
      />
    );

    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledWith('/flights/flight-1/video/thumbnail', {
      signal: expect.any(AbortSignal),
    });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:thumbnail');
    fireEvent.click(
      screen.getByRole('button', { name: 'Enlarge Flight video thumbnail' })
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Flight video thumbnail'
    );
  });

  it('shows a fallback when the thumbnail cannot load', async () => {
    renderThumbnail(
      <FlightMediaThumbnail
        path="/flights/flight-1/video/thumbnail"
        alt="Flight video thumbnail"
      />
    );

    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    fireEvent.error(screen.getByRole('img'));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:thumbnail');
    expect(
      screen.getByText('flights.mediaThumbnailUnavailable')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('loads a new thumbnail after the path changes', async () => {
    apiGet
      .mockReturnValueOnce({
        blob: () => Promise.reject(new Error('thumbnail unavailable')),
      })
      .mockReturnValueOnce({
        blob: () => Promise.resolve(new Blob(['jpeg'])),
      });
    const view = renderThumbnail(
      <FlightMediaThumbnail path="/first/thumbnail" alt="First thumbnail" />
    );
    await screen.findByText('flights.mediaThumbnailUnavailable');

    view.rerender(
      <FlightMediaThumbnail path="/second/thumbnail" alt="Second thumbnail" />
    );

    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: 'Second thumbnail' })
      ).toHaveAttribute('src', 'blob:thumbnail')
    );
    expect(apiGet).toHaveBeenLastCalledWith('/second/thumbnail', {
      signal: expect.any(AbortSignal),
    });
  });
});
