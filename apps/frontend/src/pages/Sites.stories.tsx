import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import { expect } from 'storybook/test';
import { Sites } from './Sites';

const meta = preview.meta({
  title: 'Pages/Sites',
  component: Sites,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});



const mockSites = {
  sites: [
    {
      id: 'site-arguel',
      code: 'ARG',
      name: 'Arguel',
      latitude: 47.2,
      longitude: 6.0,
      elevation_m: 427,
      region: 'Doubs',
      country: 'FR',
      orientation: 'SW',
      usage_type: 'takeoff',
      flight_count: 12,
      is_active: true,
    },
    {
      id: 'site-chalais',
      code: 'CHA',
      name: 'Chalais',
      latitude: 47.18,
      longitude: 6.22,
      elevation_m: 920,
      region: 'Doubs',
      country: 'FR',
      orientation: 'W',
      usage_type: 'takeoff',
      flight_count: 5,
      is_active: true,
    },
    {
      id: 'site-plaine',
      code: 'PLA',
      name: "Plaine d'Arguel",
      latitude: 47.19,
      longitude: 5.99,
      elevation_m: 250,
      region: 'Doubs',
      country: 'FR',
      usage_type: 'landing',
      flight_count: 0,
      is_active: true,
    },
  ],
};

const defaultHandlers = [
  http.get('*/api/spots', () => HttpResponse.json(mockSites)),
  http.get('*/api/sites/:siteId/landings', () => HttpResponse.json([])),
  http.patch('*/api/sites/:siteId', () => HttpResponse.json({ success: true })),
  http.delete('*/api/sites/:siteId', () =>
    HttpResponse.json({ success: true })
  ),
];

export const Default = meta.story({
  name: 'Default',
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test('renders sites with filter bar', async ({ canvas }) => {
  await canvas.findByText('Gestion des Sites');
  await expect(canvas.getByText('Arguel')).toBeInTheDocument();
  await expect(canvas.getByText('Chalais')).toBeInTheDocument();
  await expect(canvas.getByText("Plaine d'Arguel")).toBeInTheDocument();
  await expect(canvas.getByText(/3 site/)).toBeInTheDocument();
});

export const FilteredByType = meta.story({
  name: 'Filtered By Type',
  parameters: { msw: { handlers: defaultHandlers } },
});

FilteredByType.test(
  'filters by landing type',
  async ({ canvas, userEvent }) => {
    await canvas.findByText('Gestion des Sites');

    const typeSelect = canvas.getByDisplayValue('Tous les types');
    await userEvent.selectOptions(typeSelect, 'landing');

    await expect(canvas.getByText(/1 site/)).toBeInTheDocument();
    await expect(canvas.getByText("Plaine d'Arguel")).toBeInTheDocument();
  }
);

export const EmptyState = meta.story({
  name: 'Empty State',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots', () => HttpResponse.json({ sites: [] })),
      ],
    },
  },
});

EmptyState.test('shows empty state', async ({ canvas }) => {
  await canvas.findByText(/Aucun site/);
});

export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});
