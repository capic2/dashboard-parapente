import type { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import MonthlyStats from './MonthlyStats';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
  title: 'Components/Stats/MonthlyStats',
  component: MonthlyStats,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div style={{ maxWidth: '1200px', padding: '20px' }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MonthlyStats>;

export default meta;

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
