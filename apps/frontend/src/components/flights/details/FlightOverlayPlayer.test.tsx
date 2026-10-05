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
});
