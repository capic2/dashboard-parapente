import type { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import TimeOfDayChart from './TimeOfDayChart';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
  title: 'Components/Stats/TimeOfDayChart',
  component: TimeOfDayChart,
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
} satisfies Meta<typeof TimeOfDayChart>;

export default meta;

const mockFlights = [
  ...Array.from({ length: 3 }, (_, i) => ({ id: `${i}`, start_time: '09:30' })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `${i + 3}`, start_time: '11:45' })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: `${i + 8}`, start_time: '14:15' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `${i + 16}`, start_time: '16:30' })),
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
