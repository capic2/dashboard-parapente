import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { FlightViewer3D } from './FlightViewer3D';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = preview.meta({
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
    vitest: {
      skip: true, // Skip Cesium tests - requires full browser environment
    },
  },
  tags: ['autodocs', 'test-skip'],
});

export default meta;

const mockGPXData = {
  coordinates: Array.from({ length: 100 }, (_, i) => ({
    lat: 45.9 + i * 0.001,
    lon: 6.1 + i * 0.001,
    elevation: 1200 + Math.sin(i / 10) * 300,
    time: new Date(Date.now() + i * 60000).toISOString(),
  })),
};

export const Default = meta.story({
  args: {
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/:id/gpx*', () => {
          return HttpResponse.json(mockGPXData);
        }),
        http.get('*/api/flights/:id*', () => {
          return HttpResponse.json({
            id: 'flight-1',
            name: 'Test Flight',
            site_id: '1',
          });
        }),
      ],
    },
  },
});

export const Loading = meta.story({
  args: {
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/:id/gpx*', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});

export const Error = meta.story({
  args: {
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/:id/gpx*', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
});
