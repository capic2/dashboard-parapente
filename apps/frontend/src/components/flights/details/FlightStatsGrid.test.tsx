import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Flight } from '../../../types';
import { FlightStatsGrid } from './FlightStatsGrid';

const useFlightGPXMock = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (key: string, options?: { time?: string }) =>
      options?.time ? `${key} ${options.time}` : key,
  }),
}));

vi.mock('../../../stores/appSettingsStore', () => ({
  formatAltitudeMeters: (value: number) => `${value} m`,
  formatDistanceKm: (value: number) => `${value} km`,
  formatSpeedKmh: (value: number) => `${value} km/h`,
  useAppSettingsStore: () => ({
    altitude: 'm',
    distance: 'km',
    speed: 'kmh',
  }),
}));

vi.mock('../../../hooks/flights/useFlightGPX', () => ({
  useFlightGPX: useFlightGPXMock,
}));

useFlightGPXMock.mockReturnValue({
  isPending: false,
  data: {
    coordinates: [
      {
        lat: 47.2,
        lon: 6,
        elevation: 420,
        timestamp: 1_742_048_400_000,
        speed_kmh: 20,
      },
      {
        lat: 47.3,
        lon: 6.1,
        elevation: 880,
        timestamp: 1_742_049_000_000,
        speed_kmh: 52.3,
      },
      {
        lat: 47.4,
        lon: 6.2,
        elevation: 500,
        timestamp: 1_742_049_600_000,
        speed_kmh: 10,
      },
    ],
    max_altitude_m: 1_850,
    min_altitude_m: 380,
    altitude_range_m: 1_470,
    takeoff_altitude_m: 420,
    landing_altitude_m: 380,
    elevation_gain_m: 1_200,
    elevation_loss_m: 1_240,
    total_distance_km: 18.5,
    max_distance_from_takeoff_km: 8.4,
    flight_duration_seconds: 5_700,
    average_speed_kmh: 11.7,
    max_speed_kmh: 52.3,
    max_climb_rate_ms: 4.6,
    max_sink_rate_ms: 3.2,
  },
});

const flight = {
  id: 'flight-1',
  flight_date: '2026-03-15',
  duration_minutes: 95,
  distance_km: 18.5,
  max_altitude_m: 1_850,
  max_speed_kmh: 52.3,
  elevation_gain_m: 1_200,
  gpx_file_path: '/private/tracks/flight.gpx',
} as Flight;

describe('FlightStatsGrid', () => {
  it('shows the detailed metrics calculated from the track', () => {
    render(<FlightStatsGrid flight={flight} sites={[]} />);

    expect(screen.getByText('4.6 m/s')).toBeInTheDocument();
    expect(screen.getByText('3.2 m/s')).toBeInTheDocument();
    expect(screen.getAllByText(/flights\.metricAtTime/u)).toHaveLength(8);
    expect(screen.getByText('11.7 km/h')).toBeInTheDocument();
    expect(screen.getByText('8.4 km')).toBeInTheDocument();
    expect(screen.getByText('1470 m')).toBeInTheDocument();
    expect(screen.getByText('420 m')).toBeInTheDocument();
    expect(screen.getAllByText('380 m')).toHaveLength(2);
  });

  it('does not attach a track time to a manually different altitude', () => {
    useFlightGPXMock.mockReturnValueOnce({
      isPending: false,
      data: {
        coordinates: [
          { lat: 47.2, lon: 6, elevation: 420, timestamp: 1_742_048_400_000 },
          { lat: 47.3, lon: 6.1, elevation: 880, timestamp: 1_742_049_000_000 },
        ],
        max_altitude_m: 880,
        min_altitude_m: 420,
        elevation_gain_m: 460,
        elevation_loss_m: 0,
        total_distance_km: 1,
        flight_duration_seconds: 600,
      },
    });

    render(
      <FlightStatsGrid
        flight={{ ...flight, max_altitude_m: 1_000 } as Flight}
        sites={[]}
      />
    );

    expect(screen.queryAllByText(/flights\.metricAtTime/u)).toHaveLength(5);
  });

  it('shows the unavailable state for an empty track', () => {
    useFlightGPXMock.mockReturnValueOnce({
      isPending: false,
      data: {
        coordinates: [],
        max_altitude_m: 0,
        min_altitude_m: 0,
        elevation_gain_m: 0,
        elevation_loss_m: 0,
        total_distance_km: 0,
        flight_duration_seconds: 0,
      },
    });

    render(<FlightStatsGrid flight={flight} sites={[]} />);

    expect(
      screen.getByText('flights.trackAnalysisUnavailable')
    ).toBeInTheDocument();
    expect(screen.queryByText('flights.minAltitudeLabel')).toBeNull();
  });
});
