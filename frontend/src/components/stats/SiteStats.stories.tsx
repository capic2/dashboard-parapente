import type { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import SiteStats from './SiteStats';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
  title: 'Components/Stats/SiteStats',
  component: SiteStats,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div style={{ maxWidth: '900px', padding: '20px' }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SiteStats>;

export default meta;

const mockFlights = [
  ...Array.from({ length: 15 }, (_, i) => ({ id: `${i}`, site_name: 'Annecy', site_id: '1' })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `${i + 15}`, site_name: 'Chamonix', site_id: '2' })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: `${i + 25}`, site_name: 'Mont Poupet', site_id: '3' })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `${i + 33}`, site_name: 'Talloires', site_id: '4' })),
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
