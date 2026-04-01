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



export const defaultFlights = [
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

export const noDataFlights: typeof defaultFlights = [];

export const Default = meta.story({
  name: 'Default',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights', () =>
          HttpResponse.json({ flights: defaultFlights })
        ),
      ],
    },
  },
});

export const NoData = meta.story({
  name: 'No Data',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights', () =>
          HttpResponse.json({ flights: noDataFlights })
        ),
      ],
    },
  },
});

export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights', () => new Promise(() => {})),
      ],
    },
  },
});
