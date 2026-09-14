import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RecordsDashboard from './RecordsDashboard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (key: string) => key,
  }),
}));

const verticalRecord = {
  flight_id: 'flight-1',
  flight_name: 'Vol thermique',
  flight_date: '2026-03-15',
  site_name: 'Arguel',
  site_id: 'site-arguel',
  departure_time: '2026-03-15T14:00:00',
  partial: false,
};

describe('RecordsDashboard', () => {
  it('shows maximum climb and descent speeds', () => {
    render(
      <RecordsDashboard
        records={{
          longest_duration: null,
          highest_altitude: null,
          longest_distance: null,
          max_speed: null,
          max_climb_rate: { ...verticalRecord, value: 4.2 },
          max_sink_rate: { ...verticalRecord, value: 3.4 },
          takeoff_elevation_gain: null,
          earliest_takeoff: null,
          latest_takeoff: null,
          most_used_takeoff: null,
          most_active_month: null,
        }}
      />
    );

    expect(screen.getByText('records.maxClimbRate')).toBeInTheDocument();
    expect(screen.getByText('+4.2 m/s')).toBeInTheDocument();
    expect(screen.getByText('records.maxSinkRate')).toBeInTheDocument();
    expect(screen.getByText('-3.4 m/s')).toBeInTheDocument();
  });
});
