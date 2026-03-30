import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import preview from '../../../.storybook/preview';
import { expect, userEvent, waitFor } from 'storybook/test';
import LandingAssociationsManager from './LandingAssociationsManager';

const meta = preview.meta({
  title: 'Components/Forms/LandingAssociationsManager',
  component: LandingAssociationsManager,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <div
            style={{ maxWidth: '400px', padding: '1rem', background: '#fff' }}
          >
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});

export default meta;

// Mock data
const mockAssociations = [
  {
    id: 'assoc-1',
    takeoff_site_id: 'site-arguel',
    landing_site_id: 'site-plaine-arguel',
    is_primary: true,
    distance_km: 1.34,
    notes: 'Atterrissage principal, grand champ',
    landing_site: {
      id: 'site-plaine-arguel',
      name: "Plaine d'Arguel",
      latitude: 47.19,
      longitude: 5.99,
      elevation_m: 250,
      country: 'FR',
      usage_type: 'landing' as const,
      flight_count: 0,
      is_active: true,
    },
    created_at: '2026-03-20T10:00:00',
  },
  {
    id: 'assoc-2',
    takeoff_site_id: 'site-arguel',
    landing_site_id: 'site-secours',
    is_primary: false,
    distance_km: 2.1,
    notes: 'Si vent fort du nord',
    landing_site: {
      id: 'site-secours',
      name: 'Terrain de secours',
      latitude: 47.21,
      longitude: 6.01,
      elevation_m: 280,
      country: 'FR',
      usage_type: 'landing' as const,
      flight_count: 0,
      is_active: true,
    },
    created_at: '2026-03-20T10:05:00',
  },
];

const mockSites = {
  sites: [
    {
      id: 'site-arguel',
      name: 'Arguel',
      latitude: 47.2,
      longitude: 6.0,
      elevation_m: 427,
      country: 'FR',
      usage_type: 'takeoff',
      flight_count: 5,
      is_active: true,
    },
    {
      id: 'site-plaine-arguel',
      name: "Plaine d'Arguel",
      latitude: 47.19,
      longitude: 5.99,
      elevation_m: 250,
      country: 'FR',
      usage_type: 'landing',
      flight_count: 0,
      is_active: true,
    },
    {
      id: 'site-secours',
      name: 'Terrain de secours',
      latitude: 47.21,
      longitude: 6.01,
      elevation_m: 280,
      country: 'FR',
      usage_type: 'landing',
      flight_count: 0,
      is_active: true,
    },
    {
      id: 'site-vallee',
      name: 'Atterrissage Vallee',
      latitude: 47.18,
      longitude: 5.98,
      elevation_m: 230,
      country: 'FR',
      usage_type: 'both',
      flight_count: 0,
      is_active: true,
    },
  ],
};

const defaultHandlers = [
  http.get('*/api/sites/:siteId/landings', () => {
    return HttpResponse.json(mockAssociations);
  }),
  http.get('*/api/spots', () => {
    return HttpResponse.json(mockSites);
  }),
  http.post('*/api/sites/:siteId/landings', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'assoc-new',
        takeoff_site_id: 'site-arguel',
        landing_site_id: body.landing_site_id,
        is_primary: body.is_primary || false,
        distance_km: 3.5,
        notes: body.notes || null,
        landing_site: {
          id: body.landing_site_id,
          name: 'Atterrissage Vallee',
          latitude: 47.18,
          longitude: 5.98,
          elevation_m: 230,
          country: 'FR',
          usage_type: 'both',
          flight_count: 0,
          is_active: true,
        },
        created_at: '2026-03-20T12:00:00',
      },
      { status: 201 }
    );
  }),
  http.patch('*/api/sites/:siteId/landings/:assocId', () => {
    return HttpResponse.json({ ...mockAssociations[1], is_primary: true });
  }),
  http.delete('*/api/sites/:siteId/landings/:assocId', () => {
    return HttpResponse.json({ success: true, message: 'Deleted' });
  }),
];

// Story: With existing associations
export const WithAssociations = meta.story({
  args: {
    takeoffSiteId: 'site-arguel',
  },
  parameters: {
    msw: { handlers: defaultHandlers },
  },
});

WithAssociations.test(
  'displays existing landing associations',
  async ({ canvas }) => {
    await canvas.findByText("Plaine d'Arguel");
    await expect(canvas.getByText(/1\.34 km/)).toBeInTheDocument();
    await expect(canvas.getByText('Terrain de secours')).toBeInTheDocument();
    await expect(canvas.getByText(/2\.1 km/)).toBeInTheDocument();
  }
);

// Story: Empty state
export const Empty = meta.story({
  args: {
    takeoffSiteId: 'site-arguel',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', () => {
          return HttpResponse.json([]);
        }),
        http.get('*/api/spots', () => {
          return HttpResponse.json(mockSites);
        }),
        ...defaultHandlers.slice(2),
      ],
    },
  },
});

Empty.test('shows empty state message', async ({ canvas }) => {
  await canvas.findByText('Aucun atterrissage associé');
  await expect(
    canvas.getByText('+ Ajouter un atterrissage')
  ).toBeInTheDocument();
});

// Story: Adding a new association
export const AddingAssociation = meta.story({
  args: {
    takeoffSiteId: 'site-arguel',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', () => {
          return HttpResponse.json([]);
        }),
        http.get('*/api/spots', () => {
          return HttpResponse.json(mockSites);
        }),
        ...defaultHandlers.slice(2),
      ],
    },
  },
});

AddingAssociation.test(
  'opens add form when clicking add button',
  async ({ canvas }) => {
    const user = userEvent.setup();

    // Wait for sites to load so button is enabled before clicking
    const addButton = await canvas.findByText('+ Ajouter un atterrissage');
    await waitFor(async () => await expect(addButton).toBeEnabled());
    await user.click(addButton);

    await expect(
      await canvas.findByText('Choisir un site...')
    ).toBeInTheDocument();
    await expect(
      canvas.getByPlaceholderText('Notes (optionnel)')
    ).toBeInTheDocument();
    await expect(canvas.getByText('Ajouter')).toBeInTheDocument();
    await expect(canvas.getByText('Annuler')).toBeInTheDocument();
  }
);

// Story: With notes displayed
export const WithNotes = meta.story({
  args: {
    takeoffSiteId: 'site-arguel',
  },
  parameters: {
    msw: { handlers: defaultHandlers },
  },
});

WithNotes.test('displays notes for associations', async ({ canvas }) => {
  await canvas.findByText(/grand champ/);
  await expect(canvas.getByText(/vent fort du nord/)).toBeInTheDocument();
});

// Story: Loading state
export const Loading = meta.story({
  args: {
    takeoffSiteId: 'site-arguel',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', async () => {
          await new Promise(() => {}); // Never resolves
        }),
        http.get('*/api/spots', () => {
          return HttpResponse.json(mockSites);
        }),
      ],
    },
  },
});
