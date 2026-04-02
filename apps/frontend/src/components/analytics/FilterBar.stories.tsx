import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilterBar } from './FilterBar';
import { Site } from '@dashboard-parapente/shared-types';

const meta = preview.meta({
  title: 'Components/Stats/FilterBar',
  component: FilterBar,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
            staleTime: 0,
          },
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '1200px', padding: '20px' }}>
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

export const defaultSites: Site[] = [
  {
    id: 'site-arguel',
    code: 'ARGUEL',
    name: 'Arguel',
    elevation_m: 427,
    latitude: 47.2518,
    longitude: 6.1234,
    region: 'Franche-Comté',
    country: 'FR',
    camera_distance: 500,
    flight_count: 12,
    is_active: true,
    created_at: '2025-09-01T10:00:00Z',
    updated_at: '2025-09-01T10:00:00Z',
  },
  {
    id: 'site-mont-poupet',
    code: 'MONT_POUPET',
    name: 'Mont Poupet',
    elevation_m: 842,
    latitude: 47.3267,
    longitude: 6.189,
    region: 'Franche-Comté',
    country: 'FR',
    camera_distance: 500,
    flight_count: 45,
    is_active: true,
    created_at: '2025-09-01T10:00:00Z',
    updated_at: '2025-09-01T10:00:00Z',
  },
  {
    id: 'site-la-cote',
    code: 'LA_COTE',
    name: 'La Côte',
    elevation_m: 800,
    latitude: 47.1456,
    longitude: 6.2456,
    region: 'Franche-Comté',
    country: 'FR',
    camera_distance: 500,
    flight_count: 8,
    is_active: true,
    created_at: '2025-09-01T10:00:00Z',
    updated_at: '2025-09-01T10:00:00Z',
  },
];

export const noSites: Site[] = [];

export const Default = meta.story({
  name: 'Default',
  args: {
    sites: defaultSites,
  },
});

export const NoSites = meta.story({
  name: 'No Sites',
  args: {
    sites: noSites,
  },
});

export const Loading = meta.story({
  name: 'Loading',
  args: {
    sites: [],
  },
});
