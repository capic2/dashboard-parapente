import { http, HttpResponse } from 'msw';
import { expect } from 'storybook/test';
import preview from '../../../.storybook/preview';
import LiveWindCard from './LiveWindCard';

const meta = preview.meta({
  title: 'Components/Weather/LiveWindCard',
  component: LiveWindCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
});

const mockLiveWind = {
  site_id: 'site-arguel',
  site_name: 'Arguel',
  source: 'spotair' as const,
  radius_km: 10,
  stations: [
    {
      id: 'ffvl_5043',
      provider: 'ffvl',
      provider_id: '5043',
      name: 'Arguel Nord',
      latitude: 47.21,
      longitude: 6.01,
      altitude_m: 450,
      distance_km: 1.2,
      last_report_at: '2025-06-15T08:22:00Z',
      age_minutes: 8,
      is_outdated: false,
      wind_avg_kmh: 14,
      wind_min_kmh: 9,
      wind_max_kmh: 22,
      wind_direction_deg: 225,
      temperature_c: 20,
      cloud_ceiling_m: 1800,
      source_url: 'https://balisemeteo.com/balise.php?idBalise=5043',
    },
    {
      id: 'ffvl_9999',
      provider: 'ffvl',
      provider_id: '9999',
      name: 'Chalais Ouest',
      latitude: 47.18,
      longitude: 6.21,
      altitude_m: 870,
      distance_km: 4.1,
      last_report_at: '2025-06-15T07:10:00Z',
      age_minutes: 80,
      is_outdated: true,
      wind_avg_kmh: 18,
      wind_min_kmh: 12,
      wind_max_kmh: 28,
      wind_direction_deg: 270,
      temperature_c: 16,
      cloud_ceiling_m: 1500,
      source_url: 'https://balisemeteo.com/balise.php?idBalise=9999',
    },
  ],
};

export const Default = meta.story({
  args: {
    siteId: 'site-arguel',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/site-arguel/live-wind', () =>
          HttpResponse.json(mockLiveWind)
        ),
      ],
    },
  },
});

Default.test('renders nearest station', async ({ canvas }) => {
  await canvas.findByText(/Arguel Nord/);
  await expect(
    canvas.getByText(/SpotAiR Live Wind|Vent live SpotAiR/)
  ).toBeInTheDocument();
});

export const Empty = meta.story({
  args: {
    siteId: 'site-arguel',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/site-arguel/live-wind', () =>
          HttpResponse.json({
            site_id: 'site-arguel',
            site_name: 'Arguel',
            source: 'spotair',
            radius_km: 10,
            stations: [],
          })
        ),
      ],
    },
  },
});

export const Loading = meta.story({
  args: {
    siteId: 'site-arguel',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/site-arguel/live-wind', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});

export const ErrorState = meta.story({
  name: 'Error',
  args: {
    siteId: 'site-arguel',
  },
  parameters: {
    msw: {
      handlers: [
        http.get(
          '*/api/sites/site-arguel/live-wind',
          () => new HttpResponse(null, { status: 502 })
        ),
      ],
    },
  },
});
