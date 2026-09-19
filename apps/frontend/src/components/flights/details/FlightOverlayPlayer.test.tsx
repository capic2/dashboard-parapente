import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlightOverlayPlayer } from './FlightOverlayPlayer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('FlightOverlayPlayer', () => {
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
