import preview from '../../.storybook/preview';
import SiteSelector from './SiteSelector';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

// Mock data for sites
const mockSites = [
  {
    id: 'site-arguel',
    name: 'Arguel',
    elevation_m: 427,
    latitude: 47.2,
    longitude: 6.0,
    orientation: 'N',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mont-poupet-nord',
    name: 'Mont Poupet Nord',
    elevation_m: 842,
    latitude: 46.9,
    longitude: 5.8,
    orientation: 'N',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mont-poupet-sud',
    name: 'Mont Poupet Sud',
    elevation_m: 842,
    latitude: 46.9,
    longitude: 5.8,
    orientation: 'S',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mont-poupet-ouest',
    name: 'Mont Poupet Ouest',
    elevation_m: 842,
    latitude: 46.9,
    longitude: 5.8,
    orientation: 'W',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'site-la-cote',
    name: 'La Côte',
    elevation_m: 800,
    latitude: 46.8,
    longitude: 6.3,
    orientation: 'W',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Create a fresh query client for each story
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// CSF Factory - meta export
const meta = preview.meta({
  title: 'Components/SiteSelector',
  component: SiteSelector,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Site selector component for choosing paragliding sites. Uses React Query for data fetching.',
      },
    },
    msw: {
      handlers: [
        http.get('/api/spots', () => {
          return HttpResponse.json({
            sites: mockSites,
          });
        }),
      ],
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <QueryClientProvider client={createQueryClient()}>
        <div style={{ width: '600px' }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  argTypes: {
    selectedSiteId: {
      control: 'select',
      options: mockSites.map((s) => s.id),
      description: 'Currently selected site ID',
    },
    onSelectSite: {
      action: 'site-selected',
      description: 'Callback when a site is selected',
    },
  },
});



/**
 * Default story showing Arguel selected
 */
export const Default = meta.story({
  args: {
    selectedSiteId: 'site-arguel',
    onSelectSite: (siteId: string) => console.log('Site selected:', siteId),
  },
});

/**
 * Story showing Mont Poupet Nord selected
 * Demonstrates multi-orientation site selection (dropdown)
 */
export const MontPoupetSelected = meta.story({
  args: {
    selectedSiteId: 'mont-poupet-nord',
    onSelectSite: (siteId: string) => console.log('Site selected:', siteId),
  },
});

/**
 * Story showing La Côte selected
 */
export const LaCoteSelected = meta.story({
  args: {
    selectedSiteId: 'site-la-cote',
    onSelectSite: (siteId: string) => console.log('Site selected:', siteId),
  },
});

// Loading state story
export const Loading = meta.story({
  args: {
    selectedSiteId: '',
    onSelectSite: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Loading state while fetching sites',
      },
    },
  },
  render: () => {
    return (
      <div className="mb-4">
        <div className="flex gap-2 flex-wrap bg-white rounded-xl p-3 shadow-md">
          <div className="flex-1 min-w-[120px] p-3 border-2 border-gray-300 rounded-lg bg-white cursor-not-allowed text-gray-400">
            Chargement...
          </div>
        </div>
      </div>
    );
  },
});

// Error state story
export const Error = meta.story({
  args: {
    selectedSiteId: '',
    onSelectSite: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Error state when failing to fetch sites',
      },
    },
  },
  render: () => {
    return (
      <div className="mb-4">
        <div className="flex gap-2 flex-wrap bg-white rounded-xl p-3 shadow-md">
          <div className="flex-1 min-w-[120px] p-3 border-2 border-gray-300 rounded-lg bg-white cursor-not-allowed text-gray-400">
            Erreur de chargement
          </div>
        </div>
      </div>
    );
  },
});
