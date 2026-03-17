import type { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import AltitudeChart from './AltitudeChart';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
  title: 'Components/Stats/AltitudeChart',
  component: AltitudeChart,
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
} satisfies Meta<typeof AltitudeChart>;

export default meta;

const mockFlights = [
  { id: '1', flight_date: '2024-01-15', max_altitude_m: 1200, site_name: 'Annecy' },
  { id: '2', flight_date: '2024-01-20', max_altitude_m: 1500, site_name: 'Chamonix' },
  { id: '3', flight_date: '2024-02-05', max_altitude_m: 1800, site_name: 'Mont Poupet' },
  { id: '4', flight_date: '2024-02-15', max_altitude_m: 2200, site_name: 'Talloires' },
  { id: '5', flight_date: '2024-03-01', max_altitude_m: 2500, site_name: 'Annecy' },
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
