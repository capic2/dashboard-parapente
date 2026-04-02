import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import { expect } from 'storybook/test';
import { Sites } from './Sites';

const meta = preview.meta({
  title: 'Pages/Sites',
  component: Sites,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});

export const mockSites = {
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

export const defaultHandlers = [
  http.get('/api/spots', () => HttpResponse.json(mockSites)),
  http.get('/api/sites/:siteId/landings', () => HttpResponse.json([])),
  http.patch('/api/sites/:siteId', () => HttpResponse.json({ success: true })),
  http.delete('/api/sites/:siteId', () => HttpResponse.json({ success: true })),
];

export const Default = meta.story({
  name: 'Default',
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test('filters by landing type', async ({ canvas, userEvent }) => {
  await canvas.findByText('Gestion des Sites');

  const typeSelect = canvas.getByDisplayValue('Tous les types');
  await userEvent.selectOptions(typeSelect, 'landing');

  await expect(canvas.getByText(/1 site/)).toBeInTheDocument();
  await expect(canvas.getByText("Plaine d'Arguel")).toBeInTheDocument();
});

export const EmptyState = meta.story({
  name: 'Empty State',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/spots', () => HttpResponse.json({ sites: [] })),
      ],
    },
  },
});

export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/spots', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});
