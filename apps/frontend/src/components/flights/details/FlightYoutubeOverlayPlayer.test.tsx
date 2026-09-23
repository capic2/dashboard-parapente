// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FlightYoutubeOverlayPlayer } from './FlightYoutubeOverlayPlayer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('FlightYoutubeOverlayPlayer', () => {
  beforeEach(() => {
    const player = {
      destroy: vi.fn(),
      getCurrentTime: vi.fn(() => 10),
      getDuration: vi.fn(() => 120),
      getPlayerState: vi.fn(() => 0),
      pauseVideo: vi.fn(),
      playVideo: vi.fn(),
      seekTo: vi.fn(),
    };
    const Player = vi.fn(function (
      _element: HTMLElement,
      options: { events: { onReady: () => void } }
    ) {
      queueMicrotask(options.events.onReady);
      return player;
    });
    window.YT = { Player: Player as never };
  });

  it('resynchronizes the overlay when the saved offset changes while paused', async () => {
    const { rerender } = render(
      <FlightYoutubeOverlayPlayer
        youtubeUrl="https://www.youtube.com/watch?v=abcdefghijk"
        flightUrl="flight.mp4"
        overlayUrl="overlay.webm"
        youtubeLabel="youtube"
        flightLabel="flight"
        syncOffsetSeconds={2}
        getOverlayTime={(youtubeTime) => youtubeTime - 2}
      />
    );

    const overlay = screen.getByLabelText(
      'flights.overlayLayerReady'
    ) as HTMLVideoElement;
    await waitFor(() => expect(overlay.currentTime).toBe(8));

    rerender(
      <FlightYoutubeOverlayPlayer
        youtubeUrl="https://www.youtube.com/watch?v=abcdefghijk"
        flightUrl="flight.mp4"
        overlayUrl="overlay.webm"
        youtubeLabel="youtube"
        flightLabel="flight"
        syncOffsetSeconds={5}
        getOverlayTime={(youtubeTime) => youtubeTime - 5}
      />
    );

    await waitFor(() => expect(overlay.currentTime).toBe(5));
  });
});
