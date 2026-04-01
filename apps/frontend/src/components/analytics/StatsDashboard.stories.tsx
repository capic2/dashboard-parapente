import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import StatsDashboard from './StatsDashboard';

const meta = preview.meta({
  title: 'Components/Stats/StatsDashboard',
  component: StatsDashboard,
  decorators: [
    (Story) => {
      // Create a new QueryClient for each story to avoid cache conflicts
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0, // Disable cache
            staleTime: 0, // Always consider data stale
          },
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '1400px', padding: '20px' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
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
};

const mockFlights = Array.from({ length: 42 }, (_, i) => ({
  id: `flight-${i}`,
  flight_date: new Date(2024, Math.floor(i / 5), (i % 28) + 1)
    .toISOString()
    .split('T')[0],
  duration_minutes: 90 + Math.random() * 60,
  distance_km: 8 + Math.random() * 15,
  max_altitude_m: 1200 + Math.random() * 1000,
  site_name: ['Annecy', 'Chamonix', 'Mont Poupet'][i % 3],
}));

export const Default = meta.story({
  name: 'Default',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights/stats', () => {
          return HttpResponse.json(mockStats);
        }),
        http.get('/api/flights', () => {
          return HttpResponse.json({ flights: mockFlights });
        }),
      ],
    },
  },
});

export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights/stats', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});
