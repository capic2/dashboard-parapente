import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import TimeOfDayChart from './TimeOfDayChart';

const meta = preview.meta({
  title: 'Components/Stats/TimeOfDayChart',
  component: TimeOfDayChart,
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
  ...Array.from({ length: 3 }, (_, i) => ({ id: `${i}`, start_time: '09:30' })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `${i + 3}`, start_time: '11:45' })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: `${i + 8}`, start_time: '14:15' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `${i + 16}`, start_time: '16:30' })),
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
