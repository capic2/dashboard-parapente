import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import {
  expect,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from 'storybook/test';
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

const sitesDb: Record<string, unknown>[] = [...mockSites.sites];

const resetSitesDb = () => {
  sitesDb.length = 0;
  sitesDb.push(...mockSites.sites);
};

export const defaultHandlers = [
  http.get('/api/spots', () => HttpResponse.json({ sites: sitesDb })),
  http.post('/api/spots', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newSite = {
      id: `site-${Date.now()}`,
      ...body,
      flight_count: 0,
      is_active: true,
      created_at: '2026-04-04T00:00:00Z',
      updated_at: '2026-04-04T00:00:00Z',
    };
    sitesDb.push(newSite);
    return HttpResponse.json(newSite);
  }),
  http.get('/api/sites/:siteId/landings', () => HttpResponse.json([])),
  http.patch('/api/sites/:siteId', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const index = sitesDb.findIndex((s) => s.id === params.siteId);
    if (index !== -1) {
      sitesDb[index] = { ...sitesDb[index], ...body };
      return HttpResponse.json(sitesDb[index]);
    }
    return new HttpResponse(null, { status: 404 });
  }),
  http.delete('/api/sites/:siteId', ({ params }) => {
    const index = sitesDb.findIndex((s) => s.id === params.siteId);
    if (index !== -1) {
      sitesDb.splice(index, 1);
    }
    return HttpResponse.json({ success: true });
  }),
];

export const Default = meta.story({
  name: 'Default',
  parameters: {
    msw: { handlers: defaultHandlers },
    /*router: {
      routes: [{ path: '/flights', children: [] }],
    },*/
  },
  beforeEach: resetSitesDb,
});

Default.test('filters by landing type', async ({ canvas, userEvent }) => {
  await waitForElementToBeRemoved(canvas.getByText(/Loading.*/i));
  await expect(canvas.getAllByRole('row')).toHaveLength(3);

  const typeSelect = await canvas.findByDisplayValue('Tous les types');
  await userEvent.selectOptions(typeSelect, 'landing');

  await expect(canvas.getAllByRole('row')).toHaveLength(1);
  await expect(
    within(canvas.getByRole('row')).getByRole('heading')
  ).toHaveTextContent("Plaine d'Arguel");
});
Default.test('filters by name', async ({ canvas, userEvent }) => {
  await waitForElementToBeRemoved(canvas.getByText(/Loading.*/i));
  await expect(canvas.getAllByRole('row')).toHaveLength(3);
  await userEvent.type(
    await canvas.findByPlaceholderText('Rechercher par nom, code ou région...'),
    'cha'
  );
  await expect(canvas.getAllByRole('row')).toHaveLength(1);
  await expect(
    within(canvas.getByRole('row')).getByRole('heading')
  ).toHaveTextContent('Chalais');
});
Default.test(
  'it is possible to create a site',
  async ({ canvas, userEvent, step }) => {
    await step('Wait for page loaded', async () => {
      await waitForElementToBeRemoved(canvas.getByText(/Loading.*/i));
    });

    await step('Create a site', async () => {
      await userEvent.click(
        await canvas.findByRole('button', { name: /.*Nouveau site/ })
      );
      const dialog = within(screen.getByRole('dialog'));

      // Fill required fields
      await userEvent.type(dialog.getByLabelText(/Nom du site/), 'Mont Poupet');
      await userEvent.type(dialog.getByLabelText(/Code/), 'POUPET');
      await userEvent.clear(dialog.getByLabelText(/Latitude/));
      await userEvent.type(dialog.getByLabelText(/Latitude/), '47.238');
      await userEvent.clear(dialog.getByLabelText(/Longitude/));
      await userEvent.type(dialog.getByLabelText(/Longitude/), '6.024');

      // Select usage type
      await userEvent.click(dialog.getByLabelText('Décollage uniquement'));

      // Submit
      await userEvent.click(dialog.getByText(/Enregistrer/));
    });

    await step('Site is created', async () => {
      await waitFor(async () => {
        // Modal should close after successful creation
        await expect(screen.queryByRole('dialog')).toBeNull();
      });
      await expect(
        await canvas.findByRole('row', { name: 'Mont Poupet' })
      ).toBeInTheDocument();
    });
  }
);
Default.test(
  'it is possible to update a site',
  async ({ canvas, userEvent, step }) => {
    await step('Wait for page loaded', async () => {
      await waitForElementToBeRemoved(canvas.getByText(/Loading.*/i));
    });
    await step('Update a site', async () => {
      await userEvent.click(
        within(await canvas.findByRole('row', { name: 'Arguel' })).getByRole(
          'button',
          { name: /.*Éditer/ }
        )
      );

      const dialog = within(screen.getByRole('dialog'));

      // Fill required fields
      await userEvent.clear(dialog.getByLabelText(/Nom du site/));
      await userEvent.type(
        dialog.getByLabelText(/Nom du site/),
        'Arguel updated'
      );

      // Submit
      await userEvent.click(dialog.getByText(/Enregistrer/));
    });

    await step('Site is updated', async () => {
      await waitFor(async () => {
        // Modal should close after successful creation
        await expect(screen.queryByRole('dialog')).toBeNull();
      });
      await expect(
        await canvas.findByRole('row', { name: 'Arguel updated' })
      ).toBeInTheDocument();
    });
  }
);
Default.test(
  'it is possible to delete a site',
  async ({ canvas, userEvent, step }) => {
    await step('Wait for page loaded', async () => {
      await waitForElementToBeRemoved(canvas.getByText(/Loading.*/i));
    });
    await step('Delete a site', async () => {
      await userEvent.click(
        within(await canvas.findByRole('row', { name: 'Arguel' })).getByRole(
          'button',
          { name: '🗑️' }
        )
      );
      await userEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Supprimer',
        })
      );
    });
    await step('The site is deleted', async () => {
      await waitFor(async () => {
        // Modal should close after successful deletion
        await expect(screen.queryByRole('alertdialog')).toBeNull();
      });
      await waitFor(async () => {
        await expect(
          canvas.queryByRole('row', { name: 'Arguel' })
        ).not.toBeInTheDocument();
      });
    });
  }
);

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
