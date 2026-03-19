import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import SiteStats from './SiteStats';

const meta = preview.meta({
  title: 'Components/Stats/SiteStats',
  component: SiteStats,
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

export default meta;

const mockFlights = [
  ...Array.from({ length: 15 }, (_, i) => ({ 
    id: `${i}`, 
    site_name: 'Annecy', 
    site_id: '1',
    max_altitude_m: 1200 + i * 10,
    duration_minutes: 90 + i * 5,
    flight_date: '2024-03-15',
  })),
  ...Array.from({ length: 10 }, (_, i) => ({ 
    id: `${i + 15}`, 
    site_name: 'Chamonix', 
    site_id: '2',
    max_altitude_m: 1500 + i * 10,
    duration_minutes: 120 + i * 5,
    flight_date: '2024-03-15',
  })),
  ...Array.from({ length: 8 }, (_, i) => ({ 
    id: `${i + 25}`, 
    site_name: 'Mont Poupet', 
    site_id: '3',
    max_altitude_m: 1000 + i * 10,
    duration_minutes: 80 + i * 5,
    flight_date: '2024-03-15',
  })),
  ...Array.from({ length: 5 }, (_, i) => ({ 
    id: `${i + 33}`, 
    site_name: 'Talloires', 
    site_id: '4',
    max_altitude_m: 1300 + i * 10,
    duration_minutes: 100 + i * 5,
    flight_date: '2024-03-15',
  })),
];

const mockFlightsWithNull = [
  ...mockFlights,
  // Add flights without site_id (should be ignored)
  ...Array.from({ length: 3 }, (_, i) => ({ 
    id: `no-site-${i}`, 
    site_name: null, 
    site_id: null,
    max_altitude_m: 1000,
    duration_minutes: 60,
    flight_date: '2024-03-15',
  })),
];

export const Default = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights*', () => {
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
        http.get('*/api/flights*', () => {
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
        http.get('*/api/flights*', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});

// With flights that have null site_id (should be filtered out)
export const WithNullSiteId = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights*', () => {
          return HttpResponse.json({ flights: mockFlightsWithNull });
        }),
      ],
    },
  },
});
