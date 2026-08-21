import { render, screen } from '@testing-library/react';
import type React from 'react';
import { expect, test, vi } from 'vitest';
import type { FlightSummary } from '@dashboard-parapente/shared-types';

vi.mock('@dashboard-parapente/design-system', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Card: ({
    children,
    selected,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { selected?: boolean }) => (
    <div data-selected={selected ? 'true' : 'false'} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (key: string) => key,
  }),
}));

vi.mock('../../../stores/appSettingsStore', () => ({
  formatAltitudeMeters: (value: number) => `${value} m`,
  formatDistanceKm: (value: number) => `${value} km`,
  useAppSettingsStore: () => ({
    settings: { units: { altitude: 'metric', distance: 'metric' } },
  }),
}));

import { Flight } from './Flight';

const flight = {
  id: 'flight-1',
  flight_date: '2024-03-15',
  title: 'Vol thermique',
  name: 'Vol thermique',
  duration_minutes: 90,
  distance_km: 12.5,
  max_altitude_m: 1465,
  site_name: 'Puy de Dôme',
  site_id: 'site-1',
  site_region: 'Besançon',
  departure_time: null,
  elevation_gain_m: null,
  has_gpx: false,
  has_video: false,
  has_camera: false,
  has_youtube_video: false,
  has_gopro_overlay: false,
  has_pano_video: false,
  video_export_job_id: null,
  video_export_status: null,
  video_export_progress: null,
  gopro_overlay_job_id: null,
  gopro_overlay_status: null,
  gopro_overlay_progress: null,
} satisfies FlightSummary;

test('does not render the selected flight badge', () => {
  render(
    <Flight
      flight={flight}
      isActive={true}
      isSelected={false}
      selectionMode={false}
      onSelectFlight={() => undefined}
      onDeleteFlight={() => undefined}
    />
  );

  expect(screen.queryByText('flights.activeFlight')).not.toBeInTheDocument();
  expect(screen.getByTestId('flight-row-flight-1')).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(screen.getByTestId('flight-row-flight-1')).toHaveAttribute(
    'data-selected',
    'true'
  );
  expect(screen.getByText('Besançon - Puy de Dôme')).toBeInTheDocument();
});

test('renders media as a passive status in the flight list', () => {
  render(
    <Flight
      flight={{ ...flight, has_gpx: true }}
      isActive={false}
      isSelected={false}
      selectionMode={false}
      onSelectFlight={() => undefined}
      onDeleteFlight={() => undefined}
    />
  );

  expect(screen.getByText('flights.gpxBadge')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'flights.downloadGpx' })
  ).not.toBeInTheDocument();
  expect(screen.queryByText('flights.youtubeBadge')).not.toBeInTheDocument();
});

test('renders available media badges in the expected order', () => {
  render(
    <Flight
      flight={{
        ...flight,
        has_gpx: true,
        has_video: true,
        has_camera: true,
        has_gopro_overlay: true,
        has_youtube_video: true,
      }}
      isActive={false}
      isSelected={false}
      selectionMode={false}
      onSelectFlight={() => undefined}
      onDeleteFlight={() => undefined}
    />
  );

  const badges = [
    'flights.gpxBadge',
    'flights.videoBadge',
    'flights.cameraBadge',
    'flights.goproOverlayBadge',
    'flights.youtubeBadge',
  ].map((label) => screen.getByText(label));

  expect(badges).toEqual(
    [...badges].sort((left, right) => {
      const position = left.compareDocumentPosition(right);
      return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    })
  );
});

test('renders a panorama badge when pano.mp4 exists', () => {
  render(
    <Flight
      flight={{ ...flight, has_pano_video: true }}
      isActive={false}
      isSelected={false}
      selectionMode={false}
      onSelectFlight={() => undefined}
      onDeleteFlight={() => undefined}
    />
  );

  expect(screen.getByText('flights.panoBadge')).toBeInTheDocument();
});
