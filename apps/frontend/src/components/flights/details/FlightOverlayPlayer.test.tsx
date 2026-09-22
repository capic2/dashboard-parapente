import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlightOverlayPlayer } from './FlightOverlayPlayer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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

  it('uses the larger GoPro PiP size in the interactive layout', () => {
    render(
      <FlightOverlayPlayer
        mode="interactive"
        cameraUrl="camera.mp4"
        flightUrl="flight.mp4"
        cameraLabel="camera"
        flightLabel="flight"
      />
    );

    const camera = screen.getByLabelText('camera') as HTMLVideoElement;
    fireEvent.click(screen.getByRole('button', { name: 'flight' }));

    expect(camera.style.width).toBe('18.75%');
    expect(Number.parseFloat(camera.style.left)).toBeCloseTo(0.520833, 5);
    expect(Number.parseFloat(camera.style.bottom)).toBeCloseTo(0.925926, 5);
  });

  it('uses the configured PiP bounds from the telemetry layout', () => {
    render(
      <FlightOverlayPlayer
        mode="interactive"
        cameraUrl="camera.mp4"
        flightUrl="flight.mp4"
        cameraLabel="camera"
        flightLabel="flight"
        pipLayout={{
          id: 'video-pip',
          type: 'pip',
          action: 'switch_video',
          x: 0.1,
          y: 0.2,
          width: 0.3,
          height: 0.25,
          visible: true,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'flight' }));
    const camera = screen.getByLabelText('camera') as HTMLVideoElement;

    expect(camera.style.left).toBe('10%');
    expect(camera.style.top).toBe('20%');
    expect(camera.style.width).toBe('30%');
    expect(camera.style.height).toBe('25%');
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
});
