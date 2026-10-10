import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlightOverlayPlayer } from './FlightOverlayPlayer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  delete (window as Window & { YT?: unknown }).YT;
  delete (document as unknown as { fullscreenElement?: Element | null })
    .fullscreenElement;
});

describe('FlightOverlayPlayer', () => {
  it('renders interactive controls inside the media stage', () => {
    render(
      <FlightOverlayPlayer
        mode="interactive"
        cameraUrl="camera.mp4"
        flightUrl="flight.mp4"
        cameraLabel="camera"
        flightLabel="flight"
      />
    );

    const controls = screen.getByTestId('flight-overlay-controls');
    expect(controls).toBeInTheDocument();
    expect(controls.parentElement).toBe(
      screen.getByTestId('flight-overlay-media-stage')
    );
    expect(
      screen.getByRole('button', { name: 'flights.goproOverlayPlay' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('slider', { name: 'flights.goproOverlayTimeline' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'flights.goproOverlayFullscreen' })
    ).toBeInTheDocument();
  });

  it('renders the flight video as the main view in calibration mode', () => {
    render(
      <FlightOverlayPlayer
        mode="calibration"
        cameraUrl="camera.mp4"
        flightUrl="flight.mp4"
        cameraLabel="camera"
        flightLabel="flight"
      />
    );

    expect(screen.getByLabelText('flight')).toHaveAttribute(
      'src',
      'flight.mp4'
    );
  });

  it('shows the YouTube title suffix hint when a PiP has no match', () => {
    render(
      <FlightOverlayPlayer
        mode="interactive"
        cameraUrl="camera.mp4"
        cameraLabel="camera"
        flightLabel="flight"
        pips={[
          {
            id: 'face-pip',
            type: 'pip',
            action: 'switch_video',
            source: 'youtube:face',
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.25,
            visible: true,
            label: 'face',
          },
        ]}
      />
    );

    expect(
      screen.getByText('flights.goproOverlayYoutubePipMissing')
    ).toBeInTheDocument();
  });

  it('moves the original video into the selected PiP and restores it on a second click', () => {
    render(
      <FlightOverlayPlayer
        mode="interactive"
        cameraUrl="camera.mp4"
        cameraLabel="camera"
        flightLabel="flight"
        pips={[
          {
            id: 'flight-pip',
            type: 'pip',
            action: 'switch_video',
            source: 'file:vol',
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.25,
            visible: true,
            videoUrl: 'flight.mp4',
            label: 'flight',
          },
        ]}
      />
    );

    const camera = screen.getByLabelText('camera') as HTMLVideoElement;
    const pip = screen.getByTestId('flight-overlay-pip-flight-pip');
    fireEvent.click(screen.getByRole('button', { name: 'flight' }));

    expect(camera.style.left).toBe('10%');
    expect(camera.style.top).toBe('20%');
    expect(camera.style.width).toBe('30%');
    expect(camera.style.height).toBe('25%');
    expect(pip.style.inset).toBe('0');
    expect(pip.className).toContain('z-10');
    expect(
      screen.getByRole('button', {
        name: 'flights.goproOverlayRestoreMainVideo',
      })
    ).toHaveStyle({ left: '10%', top: '20%', width: '30%', height: '25%' });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'flights.goproOverlayRestoreMainVideo',
      })
    );

    expect(camera.style.position).toBe('');
    expect(pip.style.left).toBe('10%');
    expect(pip.style.top).toBe('20%');
    expect(pip.className).toContain('z-20');
  });

  it('switches to another PiP and restores the previously active one', () => {
    render(
      <FlightOverlayPlayer
        mode="interactive"
        cameraUrl="camera.mp4"
        cameraLabel="camera"
        flightLabel="flight"
        pips={[
          {
            id: 'pilot-pip',
            type: 'pip',
            action: 'switch_video',
            source: 'file:pilote',
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.25,
            visible: true,
            videoUrl: 'pano.mp4',
            label: 'pilot',
          },
          {
            id: 'flight-pip',
            type: 'pip',
            action: 'switch_video',
            source: 'file:vol',
            x: 0.55,
            y: 0.2,
            width: 0.3,
            height: 0.25,
            visible: true,
            videoUrl: 'flight.mp4',
            label: 'flight',
          },
        ]}
      />
    );

    const pilot = screen.getByTestId('flight-overlay-pip-pilot-pip');
    const flight = screen.getByTestId('flight-overlay-pip-flight-pip');
    fireEvent.click(screen.getByRole('button', { name: 'pilot' }));
    expect(pilot.style.inset).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'flight' }));
    expect(pilot.style.left).toBe('10%');
    expect(flight.style.inset).toBe('0');
  });

  it('resynchronizes the GPX video immediately when the offset changes', () => {
    const { rerender } = render(
      <FlightOverlayPlayer
        mode="calibration"
        cameraUrl="camera.mp4"
        flightUrl="flight.mp4"
        cameraLabel="camera"
        flightLabel="flight"
        overlayUrl="overlay.webm"
        getOverlayTime={(cameraTime) => cameraTime}
        syncOffsetSeconds={0}
      />
    );

    const camera = screen.getByLabelText('camera') as HTMLVideoElement;
    const overlay = screen.getByLabelText(
      'flights.overlayLayerReady'
    ) as HTMLVideoElement;
    camera.currentTime = 42.5;

    rerender(
      <FlightOverlayPlayer
        mode="calibration"
        cameraUrl="camera.mp4"
        flightUrl="flight.mp4"
        cameraLabel="camera"
        flightLabel="flight"
        overlayUrl="overlay.webm"
        getOverlayTime={(cameraTime) => cameraTime - 10}
        syncOffsetSeconds={10}
      />
    );

    expect(overlay.currentTime).toBe(32.5);
  });

  it('uses the provided time mapping for the GPX-generated flight video', () => {
    render(
      <FlightOverlayPlayer
        mode="interactive"
        cameraUrl="camera.mp4"
        flightUrl="flight.mp4"
        cameraLabel="camera"
        flightLabel="flight"
        getFlightTime={(cameraTime) => cameraTime - 30.9}
        pips={[
          {
            id: 'flight-pip',
            type: 'pip',
            action: 'switch_video',
            source: 'file:vol',
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.25,
            visible: true,
            videoUrl: 'flight.mp4',
            label: 'flight',
          },
        ]}
      />
    );

    const camera = screen.getByLabelText('camera') as HTMLVideoElement;
    const flight = screen
      .getByTestId('flight-overlay-pip-flight-pip')
      .querySelector('video') as HTMLVideoElement;
    camera.currentTime = 42.5;
    fireEvent.timeUpdate(camera);

    expect(flight.currentTime).toBeCloseTo(11.6, 5);
  });

  it('restores a paused seek and its PiP after exiting fullscreen', async () => {
    const { container } = render(
      <FlightOverlayPlayer
        mode="interactive"
        cameraUrl="camera.mp4"
        cameraLabel="camera"
        flightLabel="flight"
        pips={[
          {
            id: 'flight-pip',
            type: 'pip',
            action: 'switch_video',
            source: 'file:vol',
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.25,
            visible: true,
            videoUrl: 'flight.mp4',
            label: 'flight',
          },
        ]}
      />
    );
    const player = container.querySelector(
      '[data-testid="flight-overlay-media-stage"]'
    )?.parentElement;
    const camera = screen.getByLabelText('camera') as HTMLVideoElement;
    const pipVideo = screen
      .getByTestId('flight-overlay-pip-flight-pip')
      .querySelector('video') as HTMLVideoElement;
    if (!player) throw new Error('Expected the player container to render');

    Object.defineProperty(player, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          value: player,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          value: null,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });

    camera.currentTime = 51;
    fireEvent.timeUpdate(camera);
    expect(pipVideo.currentTime).toBe(51);

    fireEvent.click(
      screen.getByRole('button', { name: 'flights.goproOverlayFullscreen' })
    );
    await waitFor(() => expect(document.fullscreenElement).toBe(player));

    // Reproduce the browser losing the media position during the portal move.
    camera.currentTime = 0;
    fireEvent.timeUpdate(camera);
    expect(camera.currentTime).toBe(51);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'flights.goproOverlayExitFullscreen',
      })
    );

    await waitFor(() => {
      expect(camera.currentTime).toBe(51);
      expect(pipVideo.currentTime).toBe(51);
    });
  });

  it('keeps a backward YouTube seek while fullscreen until the player catches up', async () => {
    class MockYoutubePlayer {
      static instances: MockYoutubePlayer[] = [];
      currentTime = 0;
      state = -1;
      events: Record<string, (event?: { data: number }) => void>;
      cueVideoById = vi.fn();
      seekTo = vi.fn();
      getCurrentTime = () => this.currentTime;
      getDuration = () => 300;
      getPlayerState = () => this.state;
      destroy = vi.fn();
      mute = vi.fn();
      pauseVideo = vi.fn();
      playVideo = vi.fn();
      setOption = vi.fn();

      constructor(_host: HTMLElement, options: Record<string, unknown>) {
        MockYoutubePlayer.instances.push(this);
        this.events = options.events as MockYoutubePlayer['events'];
        queueMicrotask(() => this.events.onReady?.());
      }
    }

    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: { Player: MockYoutubePlayer },
    });
    const { container } = render(
      <FlightOverlayPlayer
        mode="interactive"
        cameraUrl="camera.mp4"
        youtubeUrl="https://www.youtube.com/watch?v=mainVideo01"
        cameraLabel="camera"
        flightLabel="flight"
      />
    );

    await waitFor(() => expect(MockYoutubePlayer.instances).toHaveLength(1));
    const youtube = MockYoutubePlayer.instances[0];
    await waitFor(() =>
      expect(
        screen.getByRole('slider', { name: 'flights.goproOverlayTimeline' })
      ).toBeEnabled()
    );

    youtube.currentTime = 50;
    fireEvent.click(
      screen.getByTestId('flight-overlay-controls').querySelector('button')!
    );
    youtube.state = 1;
    youtube.events.onStateChange?.({ data: 1 });

    const player = container.querySelector(
      '[data-testid="flight-overlay-media-stage"]'
    )?.parentElement;
    if (!player) throw new Error('Expected the player container to render');
    Object.defineProperty(player, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          value: player,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'flights.goproOverlayFullscreen' })
    );
    await waitFor(() => expect(document.fullscreenElement).toBe(player));

    fireEvent.change(
      screen.getByRole('slider', { name: 'flights.goproOverlayTimeline' }),
      { target: { value: '20' } }
    );
    expect(youtube.seekTo).toHaveBeenCalledWith(20, true);

    // The YouTube iframe reports the old time until its seek finishes.
    youtube.events.onStateChange?.({ data: 1 });
    youtube.currentTime = 20;
    youtube.events.onStateChange?.({ data: 1 });

    expect(youtube.seekTo).not.toHaveBeenCalledWith(50, true);
  });

  it('resynchronizes a YouTube PiP when its buffering seek completes', async () => {
    class MockYoutubePlayer {
      static instances: MockYoutubePlayer[] = [];
      currentTime = 0;
      state = -1;
      events: Record<string, (event?: { data: number }) => void>;
      cueVideoById = vi.fn((_: string, time = 0) => {
        this.currentTime = time;
        this.state = 5;
      });
      seekTo = vi.fn((time: number) => {
        this.currentTime = time;
      });
      getCurrentTime = () => this.currentTime;
      getDuration = () => 300;
      getPlayerState = () => this.state;
      destroy = vi.fn();
      mute = vi.fn();
      pauseVideo = vi.fn();
      playVideo = vi.fn();
      setOption = vi.fn();

      constructor(_host: HTMLElement, options: Record<string, unknown>) {
        MockYoutubePlayer.instances.push(this);
        this.events = options.events as MockYoutubePlayer['events'];
        queueMicrotask(() => this.events.onReady?.());
      }
    }

    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: { Player: MockYoutubePlayer },
    });
    const { unmount } = render(
      <FlightOverlayPlayer
        mode="interactive"
        cameraUrl="camera.mp4"
        youtubeUrl="https://www.youtube.com/watch?v=mainVideo01"
        cameraLabel="camera"
        flightLabel="flight"
        videoMarkers={[
          {
            id: 'interest',
            kind: 'interest',
            title: 'Point d’intérêt',
            timestamp_seconds: 75,
          },
        ]}
        pips={[
          {
            id: 'pilot-pip',
            type: 'pip',
            action: 'switch_video',
            source: 'youtube:pilote',
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.25,
            visible: true,
            youtubeUrl: 'https://www.youtube.com/watch?v=pipVideo001',
            label: 'pilot',
          },
        ]}
      />
    );

    await waitFor(() => expect(MockYoutubePlayer.instances).toHaveLength(2));
    const pipPlayer = MockYoutubePlayer.instances[1];
    pipPlayer.state = 3;

    fireEvent.click(
      screen.getByRole('button', { name: 'flights.overlayVideoMarkerAt' })
    );
    expect(pipPlayer.cueVideoById).not.toHaveBeenCalledWith('pipVideo001', 75);

    pipPlayer.state = 5;
    pipPlayer.events.onStateChange?.({ data: 5 });
    await waitFor(() =>
      expect(pipPlayer.cueVideoById).toHaveBeenCalledWith('pipVideo001', 75)
    );

    const requestFrame = vi.spyOn(window, 'requestAnimationFrame');
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame');
    pipPlayer.state = 3;
    pipPlayer.events.onStateChange?.({ data: 3 });
    pipPlayer.events.onStateChange?.({ data: 3 });
    expect(requestFrame).toHaveBeenCalledTimes(1);

    const pendingFrame = requestFrame.mock.results[0]?.value;
    unmount();
    expect(cancelFrame).toHaveBeenCalledWith(pendingFrame);
  });

  it('ignores delayed events from a replaced main YouTube player', async () => {
    class MockYoutubePlayer {
      static instances: MockYoutubePlayer[] = [];
      events: Record<string, (event?: { data: number }) => void>;
      cueVideoById = vi.fn();
      seekTo = vi.fn();
      getCurrentTime = () => 0;
      getDuration = () => 300;
      getPlayerState = () => -1;
      destroy = vi.fn();
      mute = vi.fn();
      pauseVideo = vi.fn();
      playVideo = vi.fn();
      setOption = vi.fn();

      constructor(_host: HTMLElement, options: Record<string, unknown>) {
        MockYoutubePlayer.instances.push(this);
        this.events = options.events as MockYoutubePlayer['events'];
      }
    }

    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: { Player: MockYoutubePlayer },
    });
    const initialProps = {
      mode: 'interactive' as const,
      cameraUrl: 'camera.mp4',
      cameraLabel: 'camera',
      flightLabel: 'flight',
      videoMarkers: [
        {
          id: 'interest',
          kind: 'interest' as const,
          title: 'Point d’intérêt',
          timestamp_seconds: 75,
        },
      ],
    };
    const { rerender } = render(
      <FlightOverlayPlayer
        {...initialProps}
        youtubeUrl="https://www.youtube.com/watch?v=oldVideo001"
      />
    );
    await waitFor(() => expect(MockYoutubePlayer.instances).toHaveLength(1));
    const oldPlayer = MockYoutubePlayer.instances[0];

    rerender(
      <FlightOverlayPlayer
        {...initialProps}
        youtubeUrl="https://www.youtube.com/watch?v=newVideo001"
      />
    );
    await waitFor(() => expect(MockYoutubePlayer.instances).toHaveLength(2));
    const currentPlayer = MockYoutubePlayer.instances[1];
    const marker = screen.getByRole('button', {
      name: 'flights.overlayVideoMarkerAt',
    });

    oldPlayer.events.onReady?.();
    expect(currentPlayer.setOption).not.toHaveBeenCalled();
    expect(marker).toBeDisabled();

    currentPlayer.events.onReady?.();
    await waitFor(() => expect(marker).toBeEnabled());

    oldPlayer.events.onError?.();
    oldPlayer.events.onStateChange?.({ data: 1 });
    expect(marker).toBeEnabled();
    expect(currentPlayer.pauseVideo).not.toHaveBeenCalled();
  });
});
