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

export const ZeroStats = meta.story({
  name: 'Zero Stats',
  args: {
    stats: {
      total_flights: 0,
      total_hours: 0,
      total_duration_minutes: 0,
      total_distance_km: 0,
      total_elevation_gain_m: 0,
      avg_duration_minutes: 0,
      avg_distance_km: 0,
      max_altitude_m: 0,
      favorite_spot: null,
      favorite_site: null,
      last_flight_date: null,
    },
  },
});

export const HighStats = meta.story({
  name: 'High Stats',
  args: {
    stats: {
      total_flights: 1847,
      total_hours: 3200,
      total_duration_minutes: 192000,
      total_distance_km: 28450.7,
      total_elevation_gain_m: 985000,
      avg_duration_minutes: 104,
      avg_distance_km: 15.4,
      max_altitude_m: 5120,
      favorite_spot: 'Mont Blanc',
      favorite_site: null,
      last_flight_date: '2025-12-15T14:30:00Z',
    },
  },
});

export const WithFavoriteSite = meta.story({
  name: 'With Favorite Site',
  args: {
    stats: {
      ...mockStats,
      favorite_spot: null,
      favorite_site: {
        id: 'site-mont-poupet',
        name: 'Mont Poupet',
        latitude: 47.3267,
        longitude: 6.189,
        country: 'FR',
        camera_distance: 500,
        flight_count: 45,
        is_active: true,
      },
    },
  },
});

export const NoFavoriteSite = meta.story({
  name: 'No Favorite Site',
  args: {
    stats: {
      ...mockStats,
      favorite_spot: null,
      favorite_site: null,
    },
  },
});
