import { expect, fn } from 'storybook/test';
import preview from '../../../.storybook/preview';
import { FlightEditForm } from './FlightEditForm';
import type { Flight, Site } from '../../types';
import i18n from 'i18next';

const mockSites: Site[] = [
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
    camera_distance: null,
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
    camera_distance: null,
  },
];

const fullFlight: Flight = {
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
  notes: 'Superbe vol thermique, base cumulus 1800m',
  gpx_file_path: '/data/flights/arguel-001.gpx',
};

const minimalFlight: Flight = {
  id: 'flight-003',
  flight_date: '2026-03-05',
  title: null,
  name: null,
  site_name: null,
  site_id: null,
  duration_minutes: null,
  distance_km: null,
  max_altitude_m: null,
  gpx_file_path: null,
  notes: null,
};

const meta = preview.meta({
  title: 'Components/Flights/FlightEditForm',
  component: FlightEditForm,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    sites: mockSites,
    onSubmit: fn(),
    onCancel: fn(),
    onShowCreateSiteModal: fn(),
  },
});

export const Default = meta.story({
  name: 'Default',
  args: {
    flight: fullFlight,
    onSubmit: fn(),
    onCancel: fn(),
    onShowCreateSiteModal: fn(),
  },
});
Default.test(
  'Edit a flight',
  async ({ canvas, userEvent, step, args: { onSubmit } }) => {
    await step('change the name', async () => {
      await userEvent.type(
        canvas.getByLabelText(i18n.t('flights.flightName')),
        ' modifié '
      );
    });

    await step('submit the change', async () => {
      await userEvent.click(
        canvas.getByRole('button', { name: i18n.t('flights.saveButton') })
      );
    });

    await step('the query is sent to the backend', async () => {
      await expect(onSubmit).toHaveBeenCalledWith({
        departure_time: '2026-03-15T14:00:00',
        distance_km: 18.5,
        duration_minutes: 95,
        elevation_gain_m: 1200,
        flight_date: '2026-03-15',
        max_altitude_m: 1850,
        max_speed_kmh: 52.3,
        name: 'Arguel 15-03 14h00 modifié ',
        notes: 'Superbe vol thermique, base cumulus 1800m',
        site_id: 'site-arguel',
        title: 'Vol thermique Arguel',
      });
    });
  }
);
Default.test(
  'Cancel flight edition',
  async ({ canvas, userEvent, step, args: { onCancel, onSubmit } }) => {
    await step('change the name', async () => {
      await userEvent.type(
        canvas.getByLabelText(i18n.t('flights.flightName')),
        ' modifié '
      );
    });

    await step('cancel the change', async () => {
      await userEvent.click(
        canvas.getByRole('button', { name: i18n.t('flights.cancel') })
      );
    });

    await step('the query is sent to the backend', async () => {
      await expect(onSubmit).not.toHaveBeenCalled();
      await expect(onCancel).toHaveBeenCalled();
      await expect(
        canvas.getByLabelText(i18n.t('flights.flightName'))
      ).toHaveValue('Arguel 15-03 14h00');
    });
  }
);
Default.test(
  'can create a new site',
  async ({ userEvent, canvas, step, args: { onShowCreateSiteModal } }) => {
    await step('try to create a new site', async () => {
      await userEvent.click(
        canvas.getByRole('button', { name: i18n.t('flights.createNewSite') })
      );
    });
    await step('the callback to create a site is called', async () => {
      await expect(onShowCreateSiteModal).toHaveBeenCalled();
    });
  }
);

export const MinimalFlightForm = meta.story({
  name: 'Minimal Flight',
  args: { flight: minimalFlight },
});
