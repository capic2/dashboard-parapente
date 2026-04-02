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

const mockWeather = {
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
    {
      hour: 14,
      temperature: 22,
      wind_speed: 15,
      wind_gust: 22,
      wind_direction: 225,
      precipitation: 0,
      cloud_cover: 30,
      para_index: 75,
      verdict: 'bon',
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
  site_id: 'site-arguel',
  site_name: 'Arguel',
  cached_at: '2025-06-15T08:30:00Z',
  score: 82,
  para_index: 78,
  verdict: 'bon',
  wind_speed: 12,
  wind_direction: 'SW',
  orientation: 'SW',
  wind_favorability: 'favorable',
  explanation: 'Vent compatible avec orientation du site',
};

const mockDailySummary = {
  site_id: 'site-arguel',
  site_name: 'Arguel',
  cached_at: '2025-06-15T08:00:00Z',
  days: Array.from({ length: 7 }, (_, i) => ({
    day_index: i,
    date: `2026-03-${24 + i}`,
    para_index: 10 * i,
    verdict: i < 3 ? 'bon' : 'moyen',
    emoji: i < 3 ? '🟢' : '🟡',
    temp_min: 10 + i,
    temp_max: 18 + i,
    wind_avg: 10 + i * 2,
  })),
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
  http.get('/api/weather/:spotId/daily-summary', () =>
    HttpResponse.json(mockDailySummary)
  ),
  http.get('/api/weather/:spotId', () => HttpResponse.json(mockWeather)),
  http.get('/api/flights/stats', () => HttpResponse.json(mockStats)),
  http.get('/api/sites/:siteId/landings', () => HttpResponse.json([])),
  http.get('/api/sites/:siteId/landings/weather', () => HttpResponse.json([])),
  http.get('/api/emagram/latest', () => HttpResponse.json(null)),
  http.get('/api/emagram/history', () => HttpResponse.json([])),
];

export const Default = meta.story({
  name: 'Default',
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test(
  'renders dashboard with site selector and weather',
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
