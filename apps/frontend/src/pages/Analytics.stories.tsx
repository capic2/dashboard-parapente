import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import Analytics from './Analytics';

const meta = preview.meta({
  title: 'Pages/Analytics',
  component: Analytics,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});



const mockStats = {
  total_flights: 42,
  total_hours: 68.5,
  total_duration_minutes: 4110,
  total_distance_km: 312.4,
  total_elevation_gain_m: 28500,
  avg_duration_minutes: 97,
  avg_distance_km: 7.4,
  max_altitude_m: 2150,
  favorite_spot: 'Arguel',
  favorite_site: null,
  last_flight_date: '2026-03-15',
};

const mockRecords = {
  longest_duration: {
    value: 180,
    flight_id: 'flight-003',
    flight_name: 'Arguel 05-03',
    flight_date: '2026-03-05',
    site_name: 'Arguel',
  },
  highest_altitude: {
    value: 2150,
    flight_id: 'flight-001',
    flight_name: 'Arguel 15-03',
    flight_date: '2026-03-15',
    site_name: 'Arguel',
  },
  longest_distance: {
    value: 25.0,
    flight_id: 'flight-003',
    flight_name: 'Arguel 05-03',
    flight_date: '2026-03-05',
    site_name: 'Arguel',
  },
  max_speed: null,
};

const mockFlights = [
  {
    id: 'flight-001',
    name: 'Vol 1',
    flight_date: '2026-03-15',
    duration_minutes: 95,
    distance_km: 18.5,
    max_altitude_m: 1850,
    max_speed_kmh: 52,
    elevation_gain_m: 1200,
    site_id: 'site-arguel',
    site_name: 'Arguel',
    departure_time: '2026-03-15T14:00:00',
  },
  {
    id: 'flight-002',
    name: 'Vol 2',
    flight_date: '2026-02-20',
    duration_minutes: 60,
    distance_km: 8.0,
    max_altitude_m: 1200,
    max_speed_kmh: 40,
    elevation_gain_m: 600,
    site_id: 'site-chalais',
    site_name: 'Chalais',
    departure_time: '2026-02-20T11:00:00',
  },
  {
    id: 'flight-003',
    name: 'Vol 3',
    flight_date: '2026-01-10',
    duration_minutes: 180,
    distance_km: 25.0,
    max_altitude_m: 2150,
    max_speed_kmh: 55,
    elevation_gain_m: 1800,
    site_id: 'site-arguel',
    site_name: 'Arguel',
    departure_time: '2026-01-10T13:00:00',
  },
];

const defaultHandlers = [
  http.get('*/api/flights/stats', () => HttpResponse.json(mockStats)),
  http.get('*/api/flights/records', () => HttpResponse.json(mockRecords)),
  http.get('*/api/flights', () => HttpResponse.json({ flights: mockFlights })),
  http.get('*/api/spots', () => HttpResponse.json({ sites: [] })),
];

export const Default = meta.story({
  name: 'Default',
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test('renders analytics page with title', async ({ canvas }) => {
  await canvas.findByText(/Analyses et Statistiques/);
});

export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/stats', async () => {
          await new Promise(() => {});
        }),
        http.get('*/api/flights/records', async () => {
          await new Promise(() => {});
        }),
        http.get('*/api/flights', async () => {
          await new Promise(() => {});
        }),
        http.get('*/api/spots', () => HttpResponse.json({ sites: [] })),
      ],
    },
  },
});
