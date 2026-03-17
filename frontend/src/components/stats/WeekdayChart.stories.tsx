import type { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import WeekdayChart from './WeekdayChart';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
  title: 'Components/Stats/WeekdayChart',
  component: WeekdayChart,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div style={{ maxWidth: '600px', padding: '20px' }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof WeekdayChart>;

export default meta;

const mockFlights = [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, flight_date: '2024-01-06' })), // Saturday
  ...Array.from({ length: 8 }, (_, i) => ({ id: `${i + 5}`, flight_date: '2024-01-07' })), // Sunday
  ...Array.from({ length: 2 }, (_, i) => ({ id: `${i + 13}`, flight_date: '2024-01-08' })), // Monday
  ...Array.from({ length: 3 }, (_, i) => ({ id: `${i + 15}`, flight_date: '2024-01-10' })), // Wednesday
];

export const Default = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights', () => {
          return HttpResponse.json({ flights: mockFlights });
        }),
      ],
    },
  },
};

export const NoData = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights', () => {
          return HttpResponse.json({ flights: [] });
        }),
      ],
    },
  },
};

export const Loading = {
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
};
