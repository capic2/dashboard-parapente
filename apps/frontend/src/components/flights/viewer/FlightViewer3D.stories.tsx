import preview from '../../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

const FlightViewer3DStoryMock = ({ flightId }: { flightId: string }) => (
  <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl bg-slate-950 p-6 text-white">
    <div className="max-w-md text-center">
      <div className="mb-4 h-32 rounded-full bg-gradient-to-b from-orange-500/30 to-transparent" />
      <p className="text-lg font-semibold">FlightViewer3D</p>
      <p className="mt-2 text-sm text-slate-300">
        Cesium viewer placeholder for Storybook snapshots.
      </p>
      <p className="mt-1 text-xs text-slate-500">Flight: {flightId}</p>
    </div>
  </div>
);

const meta = preview.meta({
  title: 'Components/Complex/FlightViewer3D',
  component: FlightViewer3DStoryMock,
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
          <div style={{ width: '100%', height: '600px' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    layout: 'fullscreen',
    vitest: {
      skip: true, // Skip Cesium tests - requires full browser environment
    },
  },
  tags: ['autodocs', 'test-skip'],
});

const mockGPXData = {
  coordinates: Array.from({ length: 100 }, (_, i) => ({
    lat: 45.9 + i * 0.001,
    lon: 6.1 + i * 0.001,
    elevation: 1200 + Math.sin(i / 10) * 300,
    time: new Date(1750000800000 + i * 60000).toISOString(),
  })),
};

export const Default = meta.story({
  name: 'Default',
  args: {
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/:id/gpx-data', () => {
          return HttpResponse.json({ data: mockGPXData });
        }),
        http.get('*/api/flights/:id', () => {
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
  name: 'Loading',
  args: {
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/:id/gpx-data', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});

export const Error = meta.story({
  name: 'Error',
  args: {
    flightId: 'flight-1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights/:id/gpx-data', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      ],
    },
  },
});
