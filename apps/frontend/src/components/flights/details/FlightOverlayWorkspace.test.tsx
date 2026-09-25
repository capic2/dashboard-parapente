import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FlightOverlayWorkspace } from './FlightOverlayWorkspace';

const onOffsetPreviewChange = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@dashboard-parapente/design-system', () => ({
  Button: ({
    children,
    isDisabled,
    onPress,
  }: {
    children: React.ReactNode;
    isDisabled?: boolean;
    onPress?: () => void;
  }) => (
    <button type="button" disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));

vi.mock('../../../hooks/gopro/useGoproOverlay', () => ({
  useFlightOverlayLayer: () => ({ data: { status: 'missing' } }),
  useGenerateFlightOverlayLayer: () => ({
    isPending: false,
    isError: false,
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('./GoproOverlaySyncPreview', () => ({
  GoproOverlaySyncPreview: ({
    onOffsetChange,
  }: {
    onOffsetChange: (offset: string) => void;
  }) => (
    <button
      type="button"
      data-testid="change-offset"
      aria-label="change offset"
      onClick={() => onOffsetChange('25.8')}
    />
  ),
}));

describe('FlightOverlayWorkspace', () => {
  it('forwards draft calibration offsets to the dynamic preview', () => {
    onOffsetPreviewChange.mockClear();

    render(
      <FlightOverlayWorkspace
        flightId="flight-1"
        initialOffset="0"
        onOffsetPreviewChange={onOffsetPreviewChange}
        onSaveOffset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('change-offset'));

    expect(onOffsetPreviewChange).toHaveBeenCalledWith('25.8');
  });
});
