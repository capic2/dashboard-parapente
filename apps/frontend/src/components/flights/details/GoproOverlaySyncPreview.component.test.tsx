import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import { GoproOverlaySyncPreview } from './GoproOverlaySyncPreview';

const hooks = vi.hoisted(() => ({
  preview: null as GoproOverlayPreview | null,
  invalidateQueries: vi.fn(),
  youtubeAssociations: [] as { url: string; title: string }[],
}));

beforeEach(() => {
  hooks.preview = null;
  hooks.invalidateQueries.mockClear();
  hooks.youtubeAssociations = [];
});

afterEach(() => {
  delete window.YT;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: Record<string, string | number>) => {
      if (key === 'flights.goproOverlayAutomaticOffset') {
        return `Automatic alignment: ${String(options?.offset)} s`;
      }
      return key;
    },
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: hooks.invalidateQueries }),
}));

vi.mock('../../../hooks/gopro/useGoproOverlay', () => ({
  useGoproOverlayPreview: () => ({
    data: hooks.preview,
    isPending: false,
    isError: false,
  }),
  useGenerateGoproPreview: () => ({
    isPending: false,
    isError: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  }),
  useGenerateGoproMerge: () => ({
    isPending: false,
    isError: false,
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { token: string }) => unknown) =>
    selector({ token: 'test-token' }),
}));

vi.mock('../../../hooks/flights/useFlightTelemetry', () => ({
  useFlightTelemetry: () => ({ isPending: false, isError: false }),
}));

vi.mock('../../../hooks/flights/useYoutubeUpload', () => ({
  useYoutubeVideoAssociations: () => ({ data: hooks.youtubeAssociations }),
}));

describe('GoproOverlaySyncPreview calibration mapping', () => {
  it('keeps seek controls enabled on the local fallback after YouTube fails', async () => {
    const youtubeUrl = 'https://www.youtube.com/watch?v=calibration';
    hooks.youtubeAssociations = [{ url: youtubeUrl, title: 'Flight - pilote' }];
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: {
        Player: class {
          constructor(
            _element: HTMLElement,
            options: { events: { onError: () => void } }
          ) {
            queueMicrotask(options.events.onError);
          }
          destroy = vi.fn();
          getCurrentTime = () => 0;
          getDuration = () => 0;
          seekTo = vi.fn();
        },
      },
    });

    render(
      <GoproOverlaySyncPreview
        flightId="flight-1"
        offset="0"
        youtubeUrls={[youtubeUrl]}
        onOffsetChange={vi.fn()}
        onOffsetSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('flights.goproOverlayCameraPreview').tagName
      ).toBe('VIDEO')
    );

    const seekForwardTenth = await screen.findByRole('button', {
      name: 'flights.goproPreviewSeekForwardTenthSecond',
    });
    await waitFor(() => expect(seekForwardTenth).toBeEnabled());
  });

  it('enables YouTube seek controls when its duration loads after the player is ready', async () => {
    const youtubeUrl = 'https://www.youtube.com/watch?v=calibration';
    hooks.youtubeAssociations = [{ url: youtubeUrl, title: 'Flight - pilote' }];
    let duration = 0;
    let playerReady = false;
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: {
        Player: class {
          constructor(
            _element: HTMLElement,
            options: { events: { onReady: () => void } }
          ) {
            queueMicrotask(() => {
              playerReady = true;
              options.events.onReady();
            });
          }
          destroy = vi.fn();
          getCurrentTime = () => 0;
          getDuration = () => duration;
          seekTo = vi.fn();
        },
      },
    });

    render(
      <GoproOverlaySyncPreview
        flightId="flight-1"
        offset="0"
        youtubeUrls={[youtubeUrl]}
        onOffsetChange={vi.fn()}
        onOffsetSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const seekForwardTenth = await screen.findByRole('button', {
      name: 'flights.goproPreviewSeekForwardTenthSecond',
    });
    await waitFor(() => expect(playerReady).toBe(true));
    expect(seekForwardTenth).toBeDisabled();

    duration = 60;

    await waitFor(() => expect(seekForwardTenth).toBeEnabled());
  });

  it('renders telemetry from the first GPX coordinate and both offsets', () => {
    hooks.preview = {
      video: {
        duration_seconds: 60,
        start_time: '1970-01-01T00:16:40.000Z',
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
        start_time: '1970-01-01T00:16:40.000Z',
        end_time: '1970-01-01T00:17:00.000Z',
        duration_seconds: 20,
        enrichment_status: 'ready',
        coordinates: [
          {
            lat: 45,
            lon: 6,
            elevation: 1000,
            speed_kmh: 30,
            timestamp: 2_000_000,
          },
          {
            lat: 45.002,
            lon: 6.002,
            elevation: 1020,
            speed_kmh: 50,
            timestamp: 2_020_000,
          },
        ],
      },
      alignment: {
        automatic_offset_seconds: -3,
        manual_offset_seconds: 10.4,
        effective_offset_seconds: 7.4,
      },
    } as GoproOverlayPreview;

    const preview = (flightId: string) => (
      <GoproOverlaySyncPreview
        flightId={flightId}
        offset="10.4"
        onOffsetChange={vi.fn()}
        onOffsetSave={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const { container, rerender } = render(preview('flight-1'));

    expect(hooks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['flights'],
    });
    hooks.invalidateQueries.mockClear();
    rerender(preview('flight-2'));
    expect(hooks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['flights'],
    });

    const camera = screen.getByLabelText(
      'flights.goproOverlayCameraPreview'
    ) as HTMLVideoElement;
    Object.defineProperty(camera, 'currentTime', {
      configurable: true,
      value: 16.6,
    });
    expect(container.querySelector('time')).not.toHaveAttribute('datetime');
    fireEvent.timeUpdate(camera);

    expect(container).toHaveTextContent('1009 m');
    expect(container).toHaveTextContent('45.00092, 6.00092');
    expect(container).toHaveTextContent('7.4 s');
    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      '1970-01-01T00:33:29.200Z'
    );

    Object.defineProperty(camera, 'currentTime', {
      configurable: true,
      value: 17.6,
    });
    fireEvent.timeUpdate(camera);

    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      '1970-01-01T00:33:30.200Z'
    );
  });
});
