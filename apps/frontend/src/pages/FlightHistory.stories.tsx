import { http, HttpResponse } from 'msw';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import preview from '../../.storybook/preview';
import FlightHistory from './FlightHistory';

const meta = preview.meta({
  title: 'Pages/FlightHistory',
  component: FlightHistory,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});

export default meta;

const mockFlights = [
  {
    id: 'flight-001',
    name: 'Arguel 15-03 14h00',
    title: 'Vol thermique Arguel',
    flight_date: '2026-03-15',
    departure_time: '2026-03-15T14:00:00',
    duration_minutes: 95,
    distance_km: 18.5,
    max_altitude_m: 1850,
    max_speed_kmh: 52.3,
    elevation_gain_m: 1200,
    site_id: 'site-arguel',
    site_name: 'Arguel',
    strava_id: '123456',
    notes: 'Superbe vol thermique, base cumulus 1800m',
    gpx_file_path: '/data/flights/arguel-001.gpx',
  },
  {
    id: 'flight-002',
    name: 'Chalais 10-03 11h00',
    title: 'Vol dynamique Chalais',
    flight_date: '2026-03-10',
    departure_time: '2026-03-10T11:00:00',
    duration_minutes: 45,
    distance_km: 5.2,
    max_altitude_m: 1100,
    max_speed_kmh: 38.1,
    elevation_gain_m: 400,
    site_id: 'site-chalais',
    site_name: 'Chalais',
    notes: null,
    gpx_file_path: null,
  },
  {
    id: 'flight-003',
    name: 'Arguel 05-03 15h30',
    title: null,
    flight_date: '2026-03-05',
    departure_time: '2026-03-05T15:30:00',
    duration_minutes: 120,
    distance_km: 25.0,
    max_altitude_m: 2150,
    max_speed_kmh: 48.7,
    elevation_gain_m: 1600,
    site_id: 'site-arguel',
    site_name: 'Arguel',
    strava_id: '789012',
    notes: 'Record de distance!',
    gpx_file_path: '/data/flights/arguel-003.gpx',
  },
];

const mockSites = {
  sites: [
    {
      id: 'site-arguel',
      code: 'ARG',
      name: 'Arguel',
      latitude: 47.2,
      longitude: 6.0,
      elevation_m: 427,
      country: 'FR',
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
      country: 'FR',
      usage_type: 'takeoff',
      flight_count: 5,
      is_active: true,
    },
  ],
};

const defaultHandlers = [
  http.get('*/api/flights', () => HttpResponse.json({ flights: mockFlights })),
  http.get('*/api/flights/:id', ({ params }) => {
    const flight = mockFlights.find((f) => f.id === params.id);
    return flight
      ? HttpResponse.json(flight)
      : new HttpResponse(null, { status: 404 });
  }),
  http.get('*/api/spots', () => HttpResponse.json(mockSites)),
  http.patch('*/api/flights/:id', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      data: { ...mockFlights[0], ...(body as object) },
    });
  }),
  http.delete('*/api/flights/:id', () =>
    HttpResponse.json({ success: true, message: 'Flight deleted' })
  ),
];

export const Default = meta.story({
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test('renders flight list', async ({ canvas }) => {
  // FlightHistory shows the page header - flights may take time to load
  await canvas.findByText(/Historique des Vols|Mes Vols|Vols/);
});

export const EmptyState = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights', () => HttpResponse.json({ flights: [] })),
        http.get('*/api/spots', () => HttpResponse.json(mockSites)),
      ],
    },
  },
});

export const Loading = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/flights', async () => {
          await new Promise(() => {});
        }),
        http.get('*/api/spots', () => HttpResponse.json(mockSites)),
      ],
    },
  },
});

export const DeleteSingleFlight = meta.story({
  parameters: { msw: { handlers: defaultHandlers } },
});

DeleteSingleFlight.test(
  'opens delete modal and can cancel',
  async ({ canvas }) => {
    const user = userEvent.setup();

    // Attendre que la liste de vols s'affiche
    await canvas.findByText('Vol thermique Arguel');

    // Cliquer le bouton poubelle
    const deleteButton = await canvas.findByLabelText(
      'Supprimer le vol Vol thermique Arguel'
    );
    await user.click(deleteButton);

    // La modal de confirmation s'ouvre (portail hors du canvas → screen)
    await expect(
      await screen.findByText(/Confirmer la suppression/)
    ).toBeInTheDocument();

    // Cliquer Annuler ferme la modal
    const cancelButton = await screen.findByText('Annuler');
    await user.click(cancelButton);

    // Vérifier que la modal est fermée
    await expect(
      screen.queryByText(/Confirmer la suppression/)
    ).not.toBeInTheDocument();
  }
);

const confirmDeleteHandlers = (() => {
  const deletedIds = new Set<string>();
  return [
    http.get('*/api/flights', () =>
      HttpResponse.json({
        flights: mockFlights.filter((f) => !deletedIds.has(f.id)),
      })
    ),
    http.get('*/api/flights/:id', ({ params }) => {
      const flight = mockFlights.find(
        (f) => f.id === params.id && !deletedIds.has(f.id)
      );
      return flight
        ? HttpResponse.json(flight)
        : new HttpResponse(null, { status: 404 });
    }),
    http.get('*/api/spots', () => HttpResponse.json(mockSites)),
    http.patch('*/api/flights/:id', async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        data: { ...mockFlights[0], ...(body as object) },
      });
    }),
    http.delete('*/api/flights/:id', ({ params }) => {
      deletedIds.add(params.id as string);
      return HttpResponse.json({ success: true, message: 'Flight deleted' });
    }),
  ];
})();

export const ConfirmDeleteFlight = meta.story({
  parameters: { msw: { handlers: confirmDeleteHandlers } },
});

ConfirmDeleteFlight.test('deletes flight on confirm', async ({ canvas }) => {
  const user = userEvent.setup();

  await canvas.findByText('Vol thermique Arguel');

  // Cliquer le bouton poubelle
  const deleteButton = await canvas.findByLabelText(
    'Supprimer le vol Vol thermique Arguel'
  );
  await user.click(deleteButton);

  // Confirmer la suppression dans la modal (portail → screen)
  const dialog = await screen.findByRole('dialog');
  const dialogContent = within(dialog);
  const confirmButton = await dialogContent.findByRole('button', {
    name: /Supprimer/,
  });
  await user.click(confirmButton);

  // Le toast de succès apparaît
  await expect(
    await canvas.findByText('Vol supprimé avec succès')
  ).toBeInTheDocument();

  // Vérifier que le vol supprimé n'apparaît plus (attendre le refetch)
  await waitFor(() => {
    expect(canvas.queryByText('Vol thermique Arguel')).not.toBeInTheDocument();
  });
});

export const DeleteMultipleFlights = meta.story({
  parameters: { msw: { handlers: defaultHandlers } },
});

DeleteMultipleFlights.test(
  'opens multi-delete modal with flight count',
  async ({ canvas }) => {
    const user = userEvent.setup();

    await canvas.findByText('Vol thermique Arguel');

    // Entrer en mode sélection
    const selectButton = await canvas.findByText('☑️ Sélectionner');
    await user.click(selectButton);

    // Sélectionner tous les vols
    const selectAllButton = await canvas.findByText('Tout sélectionner');
    await user.click(selectAllButton);

    // Cliquer le bouton supprimer
    const deleteButton = await canvas.findByText(/Supprimer \(3\)/);
    await user.click(deleteButton);

    // La modal de confirmation s'ouvre (portail → screen)
    const dialog = await screen.findByRole('dialog');
    const dialogContent = within(dialog);
    await expect(
      await dialogContent.findByText(/irréversible/)
    ).toBeInTheDocument();
    // Le bouton de confirmation affiche le bon nombre
    await expect(
      await dialogContent.findByRole('button', { name: /Supprimer 3 vols/ })
    ).toBeInTheDocument();
  }
);
