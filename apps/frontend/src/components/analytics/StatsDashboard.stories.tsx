import preview from '../../../.storybook/preview';
import StatsDashboard from './StatsDashboard';

const meta = preview.meta({
  title: 'Components/Stats/StatsDashboard',
  component: StatsDashboard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
});

const mockStats = {
  total_flights: 42,
  total_hours: 85.5,
  total_distance_km: 420.5,
  max_altitude_m: 2850,
  avg_duration_minutes: 122,
  avg_distance_km: 10.0,
  total_duration_minutes: 5130,
  total_elevation_gain_m: 12000,
  favorite_spot: 'Annecy',
  favorite_site: null,
  last_flight_date: null,
};

export const Default = meta.story({
  name: 'Default',
  args: {
    stats: mockStats,
  },
});
