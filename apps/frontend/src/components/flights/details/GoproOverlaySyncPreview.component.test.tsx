import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoproOverlayPreview } from '../../../hooks/gopro/useGoproOverlay';
import { GoproOverlaySyncPreview } from './GoproOverlaySyncPreview';

const hooks = vi.hoisted(() => ({
  preview: null as GoproOverlayPreview | null,
  invalidateQueries: vi.fn(),
}));

beforeEach(() => {
  hooks.preview = null;
  hooks.invalidateQueries.mockClear();
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
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
  useYoutubeVideoAssociations: () => ({ data: [] }),
}));

describe('GoproOverlaySyncPreview calibration mapping', () => {
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
    fireEvent.timeUpdate(camera);

    expect(container).toHaveTextContent('1009 m');
    expect(container).toHaveTextContent('45.00092, 6.00092');
    expect(container).toHaveTextContent('7.4 s');
  });
});
