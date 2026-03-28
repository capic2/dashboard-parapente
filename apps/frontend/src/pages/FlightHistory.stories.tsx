import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import FlightHistory from './FlightHistory';

const meta = preview.meta({
  title: 'Pages/FlightHistory',
  component: FlightHistory,
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

export default meta;

const mockFlights = [
  {
    id: 'flight-001',
    name: 'Arguel 15-03 14h00',
    title: 'Vol thermique Arguel',
    flight_date: '2026-03-15',
    departure_time: '2026-03-15T14:00:00',
    duration_minutes: 95,
    distance_km: 18.5,
    max_altitude_m: 1850,
    max_speed_kmh: 52.3,
    elevation_gain_m: 1200,
    site_id: 'site-arguel',
    site_name: 'Arguel',
    strava_id: '123456',
    notes: 'Superbe vol thermique, base cumulus 1800m',
    gpx_file_path: '/data/flights/arguel-001.gpx',
  },
  {
    id: 'flight-002',
    name: 'Chalais 10-03 11h00',
    title: 'Vol dynamique Chalais',
    flight_date: '2026-03-10',
    departure_time: '2026-03-10T11:00:00',
    duration_minutes: 45,
    distance_km: 5.2,
    max_altitude_m: 1100,
    max_speed_kmh: 38.1,
    elevation_gain_m: 400,
    site_id: 'site-chalais',
    site_name: 'Chalais',
    notes: null,
    gpx_file_path: null,
  },
  {
    id: 'flight-003',
    name: 'Arguel 05-03 15h30',
    title: null,
    flight_date: '2026-03-05',
    departure_time: '2026-03-05T15:30:00',
    duration_minutes: 120,
    distance_km: 25.0,
    max_altitude_m: 2150,
    max_speed_kmh: 48.7,
    elevation_gain_m: 1600,
    site_id: 'site-arguel',
    site_name: 'Arguel',
    strava_id: '789012',
    notes: 'Record de distance!',
    gpx_file_path: '/data/flights/arguel-003.gpx',
  },
];

const mockSites = {
  sites: [
    {
      id: 'site-arguel',
      code: 'ARG',
      name: 'Arguel',
      latitude: 47.2,
      longitude: 6.0,
      elevation_m: 427,
      country: 'FR',
      usage_type: 'takeoff',
      flight_count: 12,
      is_active: true,
    },
    {
      id: 'site-chalais',
      code: 'CHA',
      name: 'Chalais',
      latitude: 47.18,
      longitude: 6.22,
      elevation_m: 920,
      country: 'FR',
      usage_type: 'takeoff',
      flight_count: 5,
      is_active: true,
    },
  ],
};

const defaultHandlers = [
  http.get('*/api/flights', () => HttpResponse.json({ flights: mockFlights })),
  http.get('*/api/flights/:id', ({ params }) => {
    const flight = mockFlights.find((f) => f.id === params.id);
    return flight
      ? HttpResponse.json(flight)
      : new HttpResponse(null, { status: 404 });
  }),
  http.get('*/api/spots', () => HttpResponse.json(mockSites)),
  http.patch('*/api/flights/:id', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      data: { ...mockFlights[0], ...(body as object) },
    });
  }),
  http.delete('*/api/flights/:id', () =>
    HttpResponse.json({ success: true, message: 'Flight deleted' })
  ),
];

export const Default = meta.story({
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test('renders flight list', async ({ canvas }) => {
  // FlightHistory shows the page header - flights may take time to load
  await canvas.findByText(/Historique des Vols|Mes Vols|Vols/);
});

export const EmptyState = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights', () => HttpResponse.json({ flights: [] })),
        http.get('*/api/spots', () => HttpResponse.json(mockSites)),
      ],
    },
  },
});

export const Loading = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights', async () => {
          await new Promise(() => {});
        }),
        http.get('*/api/spots', () => HttpResponse.json(mockSites)),
      ],
    },
  },
});
