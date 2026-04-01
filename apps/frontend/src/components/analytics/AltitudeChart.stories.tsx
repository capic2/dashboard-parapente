import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import AltitudeChart from './AltitudeChart';

const meta = preview.meta({
  title: 'Components/Stats/AltitudeChart',
  component: AltitudeChart,
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



export const defaultFlights = [
  {
    id: '1',
    flight_date: '2024-01-15',
    max_altitude_m: 1200,
    site_name: 'Annecy',
  },
  {
    id: '2',
    flight_date: '2024-01-20',
    max_altitude_m: 1500,
    site_name: 'Chamonix',
  },
  {
    id: '3',
    flight_date: '2024-02-05',
    max_altitude_m: 1800,
    site_name: 'Mont Poupet',
  },
  {
    id: '4',
    flight_date: '2024-02-15',
    max_altitude_m: 2200,
    site_name: 'Talloires',
  },
  {
    id: '5',
    flight_date: '2024-03-01',
    max_altitude_m: 2500,
    site_name: 'Annecy',
  },
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
