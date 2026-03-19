import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import WeekdayChart from './WeekdayChart';

const meta = preview.meta({
  title: 'Components/Stats/WeekdayChart',
  component: WeekdayChart,
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
          <div style={{ maxWidth: '600px', padding: '20px' }}>
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

const mockFlights = [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, flight_date: '2024-01-06' })), // Saturday
  ...Array.from({ length: 8 }, (_, i) => ({ id: `${i + 5}`, flight_date: '2024-01-07' })), // Sunday
  ...Array.from({ length: 2 }, (_, i) => ({ id: `${i + 13}`, flight_date: '2024-01-08' })), // Monday
  ...Array.from({ length: 3 }, (_, i) => ({ id: `${i + 15}`, flight_date: '2024-01-10' })), // Wednesday
];

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
