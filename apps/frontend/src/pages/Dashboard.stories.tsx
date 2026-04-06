import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import { expect } from 'storybook/test';
import Dashboard from './Dashboard';

const meta = preview.meta({
  title: 'Pages/Dashboard',
  component: Dashboard,
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
      usage_type: 'both',
      flight_count: 5,
      is_active: true,
    },
  ],
};

const mockWeatherArguel = {
  site_id: 'site-arguel',
  site_name: 'Arguel',
  cached_at: '2025-06-15T08:30:00Z',
  day_index: 0,
  days: 1,
  para_index: 78,
  verdict: 'bon',
  emoji: '🟢',
  explanation: 'Conditions favorables',
  consensus: [
    {
      hour: 10,
      temperature: 18,
      wind_speed: 12,
      wind_gust: 18,
      wind_direction: 225,
      precipitation: 0,
      cloud_cover: 20,
      para_index: 78,
      verdict: 'bon',
    },
  ],
};

const mockWeatherChalais = {
  site_id: 'site-chalais',
  site_name: 'Chalais',
  cached_at: '2025-06-15T08:30:00Z',
  day_index: 0,
  days: 1,
  para_index: 55,
  verdict: 'moyen',
  emoji: '🟡',
  explanation: 'Conditions moyennes',
  consensus: [
    {
      hour: 10,
      temperature: 16,
      wind_speed: 20,
      wind_gust: 28,
      wind_direction: 270,
      precipitation: 0,
      cloud_cover: 45,
      para_index: 55,
      verdict: 'moyen',
    },
  ],
};

const mockStats = {
  total_flights: 42,
  total_hours: 68.5,
  total_duration_minutes: 4110,
  total_distance_km: 312.4,
  total_elevation_gain_m: 28500,
  avg_duration_minutes: 97,
  avg_distance_km: 7.4,
  max_altitude_m: 2150,
  favorite_spot: 'Arguel',
  favorite_site: null,
  last_flight_date: '2026-03-15',
};

const mockBestSpot = {
  site: {
    id: 'site-arguel',
    name: 'Arguel',
    rating: 4,
    orientation: 'SW',
  },
  paraIndex: 78,
  windDirection: 'SW',
  windSpeed: 12,
  windFavorability: 'good',
  score: 82,
  verdict: 'BON',
  reason:
    'Bonnes conditions (Para-Index 78), 22°C, ciel dégagé, vent favorable SW 12km/h',
  flyableSlot: '10h-17h',
  thermalCeiling: 1850,
  cached_at: '2025-06-15T08:30:00Z',
};

const defaultHandlers = [
  http.get('/api/spots', () => HttpResponse.json(mockSites)),
  http.get('/api/spots/best', () => HttpResponse.json(mockBestSpot)),
  http.get('/api/spots/:id', ({ params }) => {
    const site = mockSites.sites.find((s) => s.id === params.id);
    return site
      ? HttpResponse.json(site)
      : new HttpResponse(null, { status: 404 });
  }),
  http.get('/api/weather/site-arguel', () =>
    HttpResponse.json(mockWeatherArguel)
  ),
  http.get('/api/weather/site-chalais', () =>
    HttpResponse.json(mockWeatherChalais)
  ),
  http.get('/api/flights/stats', () => HttpResponse.json(mockStats)),
];

export const Default = meta.story({
  name: 'Default',
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test(
  'renders dashboard with best spot and all sites conditions',
  async ({ canvas }) => {
    await canvas.findByText('Arguel');
    await expect(canvas.getByText('Chalais')).toBeInTheDocument();
  }
);

export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/spots', async () => {
          await new Promise(() => {});
        }),
        ...defaultHandlers.slice(1),
      ],
    },
  },
});

export const Error = meta.story({
  name: 'Error',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/spots', () => new HttpResponse(null, { status: 500 })),
        ...defaultHandlers.slice(1),
      ],
    },
  },
});
