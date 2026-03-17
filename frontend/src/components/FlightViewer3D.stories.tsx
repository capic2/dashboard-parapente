import type { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { FlightViewer3D } from './FlightViewer3D';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
  title: 'Components/Complex/FlightViewer3D',
  component: FlightViewer3D,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div style={{ width: '100%', height: '600px' }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FlightViewer3D>;

export default meta;

const mockGPXData = {
  coordinates: Array.from({ length: 100 }, (_, i) => ({
    lat: 45.9 + i * 0.001,
    lon: 6.1 + i * 0.001,
    elevation: 1200 + Math.sin(i / 10) * 300,
    time: new Date(Date.now() + i * 60000).toISOString(),
  })),
};

export const Default = {
  args: {
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/:id/gpx', () => {
          return HttpResponse.json(mockGPXData);
        }),
        http.get('http://localhost:5000/api/flights/:id', () => {
          return HttpResponse.json({
            id: 'flight-1',
            name: 'Test Flight',
            site_id: '1',
          });
        }),
      ],
    },
  },
};

export const Loading = {
  args: {
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/:id/gpx', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
};

export const Error = {
  args: {
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:5000/api/flights/:id/gpx', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
};
