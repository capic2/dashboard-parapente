import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import ProgressChart from './ProgressChart';

const meta = preview.meta({
  title: 'Components/Stats/ProgressChart',
  component: ProgressChart,
  decorators: [
    (Story) => {
      // Create a new QueryClient for each story to avoid cache conflicts
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { 
            retry: false,
            gcTime: 0,  // Disable cache
            staleTime: 0,  // Always consider data stale
          },
        },
      });
      
      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '900px', padding: '20px' }}>
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

export default meta;

const mockFlights = Array.from({ length: 30 }, (_, i) => ({
  id: `flight-${i}`,
  flight_date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
  duration_minutes: 60 + Math.random() * 120,
  distance_km: 10 + Math.random() * 30,
}));

export const Default = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights*', () => {
          return HttpResponse.json({ flights: mockFlights });
        }),
      ],
    },
  },
});

export const NoData = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights*', () => {
          return HttpResponse.json({ flights: [] });
        }),
      ],
    },
  },
});

export const Loading = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights*', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});
