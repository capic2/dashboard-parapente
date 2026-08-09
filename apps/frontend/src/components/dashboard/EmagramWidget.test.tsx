import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmagramWidget from './EmagramWidget';

const { useLatestEmagram, useEmagramHours, useTriggerEmagram } = vi.hoisted(
  () => ({
    useLatestEmagram: vi.fn(),
    useEmagramHours: vi.fn(),
    useTriggerEmagram: vi.fn(),
  })
);

vi.mock('../../hooks/weather/useEmagramAnalysis', () => ({
  useLatestEmagram,
  useEmagramHours,
  useTriggerEmagram,
}));

describe('EmagramWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEmagramHours.mockReturnValue({
      data: {
        hours: [
          {
            hour: 12,
            score: null,
            status: 'pending',
            id: 'pending-12',
          },
        ],
      },
      isLoading: false,
    });
    useLatestEmagram.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    useTriggerEmagram.mockReturnValue({
      mutateAsync: vi.fn(),
      error: null,
    });
  });

  it('enables analysis only after an hour is selected', async () => {
    const { rerender } = render(<EmagramWidget siteId="site-arguel" />);

    expect(useLatestEmagram).toHaveBeenLastCalledWith('site-arguel', 0, null, {
      enabled: false,
    });
    expect(
      screen.getByText('Choisissez une heure pour lancer l’analyse.')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Analyse 12h en attente' })
    );

    await waitFor(() => {
      expect(useLatestEmagram).toHaveBeenLastCalledWith('site-arguel', 0, 12, {
        enabled: true,
      });
    });

    rerender(<EmagramWidget siteId="site-mont-poupet" />);

    expect(
      useLatestEmagram.mock.calls.some(
        ([siteId, dayIndex, hour, options]) =>
          siteId === 'site-mont-poupet' &&
          dayIndex === 0 &&
          hour === 12 &&
          options.enabled
      )
    ).toBe(false);
    expect(useLatestEmagram).toHaveBeenLastCalledWith(
      'site-mont-poupet',
      0,
      null,
      { enabled: false }
    );
  });
});
