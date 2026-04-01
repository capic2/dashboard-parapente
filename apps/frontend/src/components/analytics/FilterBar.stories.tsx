import preview from '../../../.storybook/preview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { FilterBar } from './FilterBar';

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

export const defaultSites = [
  { id: '1', name: 'Annecy', latitude: 45.899, longitude: 6.129 },
  { id: '2', name: 'Chamonix', latitude: 45.924, longitude: 6.869 },
  { id: '3', name: 'Mont Poupet', latitude: 46.909, longitude: 5.854 },
];

export const noSites: typeof defaultSites = [];

export const Default = meta.story({
  name: 'Default',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots', () =>
          HttpResponse.json({ sites: defaultSites })
        ),
      ],
    },
  },
});

export const NoSites = meta.story({
  name: 'No Sites',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots', () =>
          HttpResponse.json({ sites: noSites })
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
        http.get('*/api/spots', () => new Promise(() => {})),
      ],
    },
  },
});
