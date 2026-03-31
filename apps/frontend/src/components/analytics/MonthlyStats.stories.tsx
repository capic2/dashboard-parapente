import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import MonthlyStats from './MonthlyStats';

const meta = preview.meta({
  title: 'Components/Stats/MonthlyStats',
  component: MonthlyStats,
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
          <div style={{ maxWidth: '1200px', padding: '20px' }}>
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



const mockFlights = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `${i}`,
    flight_date: `2024-03-${String(i + 1).padStart(2, '0')}`,
    duration_minutes: 90,
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `${i + 8}`,
    flight_date: `2024-02-${String(i + 1).padStart(2, '0')}`,
    duration_minutes: 120,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `${i + 20}`,
    flight_date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    duration_minutes: 60,
  })),
];

export const Default = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('/api/flights', () => {
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
        http.get('/api/flights', () => {
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
        http.get('/api/flights', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});
