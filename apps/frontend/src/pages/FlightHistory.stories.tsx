import { http, HttpResponse } from 'msw';
import { expect, screen, waitFor, within } from 'storybook/test';
import preview from '../../.storybook/preview';
import FlightHistory from './FlightHistory';
import i18n from 'i18next';

const meta = preview.meta({
  title: 'Pages/FlightHistory',
  component: FlightHistory,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});

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

const flightsDb: Record<string, unknown>[] = [...mockFlights];

const resetFlightsDb = () => {
  flightsDb.length = 0;
  flightsDb.push(...mockFlights);
};

const defaultHandlers = [
  http.get('*/api/flights', () => HttpResponse.json({ flights: flightsDb })),
  http.get('*/api/flights/:id', ({ params }) => {
    const flight = flightsDb.find((f) => f.id === params.id);
    return flight
      ? HttpResponse.json(flight)
      : new HttpResponse(null, { status: 404 });
  }),
  http.get('*/api/spots', () => HttpResponse.json(mockSites)),
  http.patch('*/api/flights/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const index = flightsDb.findIndex((f) => f.id === params.id);
    if (index !== -1) {
      flightsDb[index] = { ...flightsDb[index], ...body };
      return HttpResponse.json({ data: flightsDb[index] });
    }
    return new HttpResponse(null, { status: 404 });
  }),
  http.delete('*/api/flights/:id', ({ params }) => {
    const index = flightsDb.findIndex((f) => f.id === params.id);
    if (index !== -1) {
      flightsDb.splice(index, 1);
    }
    return HttpResponse.json({ success: true, message: 'Flight deleted' });
  }),
];

export const Default = meta.story({
  name: 'Default',
  parameters: { msw: { handlers: defaultHandlers } },
  beforeEach: resetFlightsDb,
});

Default.test(
  'Can cancel a simple flight deletion',
  async ({ canvas, userEvent, step }) => {
    const flightList = await canvas.findByRole('grid', {
      name: i18n.t('flights.listAriaLabel'),
    });

    await step('have flights', async () => {
      await waitFor(async () => {
        await expect(within(flightList).getAllByRole('row')).toHaveLength(
          mockFlights.length
        );
      });
    });

    await step('want to delete a flight', async () => {
      const deleteButton = canvas.getByRole('button', {
        name: i18n.t('flights.deleteAriaLabel', {
          title: 'Vol thermique Arguel',
        }),
      });

      await userEvent.click(deleteButton);
      await expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    });

    await step('cancel the deletion', async () => {
      const cancelButton = within(screen.getByRole('alertdialog')).getByRole(
        'button',
        { name: i18n.t('common.cancel') }
      );

      await userEvent.click(cancelButton);
    });

    await step('the flight is not deleted', async () => {
      await expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await expect(within(flightList).getAllByRole('row')).toHaveLength(
        mockFlights.length
      );
    });
  }
);
Default.test(
  'can delete a simple flight',
  async ({ canvas, userEvent, step }) => {
    const flightList = await canvas.findByRole('grid', {
      name: i18n.t('flights.listAriaLabel'),
    });

    await step('have flights', async () => {
      await waitFor(async () => {
        await expect(within(flightList).getAllByRole('row')).toHaveLength(
          mockFlights.length
        );
      });
    });

    await step('want to delete a flight', async () => {
      const deleteButton = canvas.getByRole('button', {
        name: i18n.t('flights.deleteAriaLabel', {
          title: 'Vol thermique Arguel',
        }),
      });

      await userEvent.click(deleteButton);
      await expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    });

    await step('confirm the deletion', async () => {
      const confirmButton = within(screen.getByRole('alertdialog')).getByRole(
        'button',
        { name: i18n.t('flights.deleteButton') }
      );

      await userEvent.click(confirmButton);
    });

    await step('the flight is deleted', async () => {
      await waitFor(async () => {
        await expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

        await expect(within(flightList).getAllByRole('row')).toHaveLength(
          mockFlights.length - 1
        );
      });
    });
  }
);
// clique sur un vol => les détails du vol
// supprimer plusieurs vols
// annuler la suppression de plusieurs vols

export const EmptyState = meta.story({
  name: 'Empty State',
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
  name: 'Loading',
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
