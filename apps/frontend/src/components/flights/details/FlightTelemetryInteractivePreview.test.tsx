import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlightTelemetryInteractivePreview } from './FlightTelemetryInteractivePreview';

const hooks = vi.hoisted(() => ({
  overlayPreview: {
    data: undefined,
    isPending: true,
    isSuccess: false,
    isError: false,
  },
  telemetry: {
    data: undefined,
    isPending: true,
    isSuccess: false,
    isError: false,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../hooks/gopro/useGoproOverlay', () => ({
  useGoproOverlayPreview: () => hooks.overlayPreview,
}));

vi.mock('../../../hooks/flights/useFlightTelemetry', () => ({
  useFlightTelemetry: () => hooks.telemetry,
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => null,
}));

vi.mock('./FlightOverlayPlayer', () => ({
  FlightOverlayPlayer: () => <div data-testid="overlay-player" />,
}));

vi.mock('./FlightTelemetryOverlay', () => ({
  FlightTelemetryOverlay: () => <div data-testid="telemetry-overlay" />,
}));

describe('FlightTelemetryInteractivePreview', () => {
  it('shows a loading state while telemetry requests are pending', () => {
    render(<FlightTelemetryInteractivePreview flightId="flight-1" />);

    expect(
      screen.getAllByText('flights.overlayInteractivePreviewLoading')
    ).toHaveLength(2);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.queryByText('flights.overlayInteractivePreviewUnavailable')
    ).not.toBeInTheDocument();
  });

  it('shows unavailable only after a request has failed', () => {
    hooks.overlayPreview.isPending = false;
    hooks.overlayPreview.isError = true;
    hooks.telemetry.isPending = false;
    hooks.telemetry.isError = true;

    render(<FlightTelemetryInteractivePreview flightId="flight-1" />);

    expect(
      screen.getAllByText('flights.overlayInteractivePreviewUnavailable')
    ).toHaveLength(2);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
