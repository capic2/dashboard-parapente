import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import { expect } from 'storybook/test';
import WeatherPage from './WeatherPage';

const meta = preview.meta({
  title: 'Pages/WeatherPage',
  component: WeatherPage,
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
  explanation: 'Conditions favorables pour le vol',
  slots_summary: 'Vol possible de 10h à 17h',
  sunrise: '06:30',
  sunset: '21:00',
  metrics: {
    avg_temp_c: 20,
    avg_wind_kmh: 12,
    max_gust_kmh: 18,
    total_rain_mm: 0,
  },
  consensus: [
    {
      hour: 10,
      temperature: 18,
      wind_speed: 12,
      wind_gust: 18,
      wind_direction: 225,
      precipitation: 0,
      cloud_cover: 20,
      cape: 600,
      para_index: 78,
      verdict: 'bon',
      thermal_strength: 'moyen',
      sources: {
        'open-meteo': {
          temperature: 18.2,
          wind_speed: 11.8,
          wind_gust: 17.5,
          wind_direction: 220,
          precipitation: 0,
          cloud_cover: 18,
        },
        weatherapi: {
          temperature: 17.8,
          wind_speed: 12.2,
          wind_gust: 18.5,
          wind_direction: 230,
          precipitation: 0,
          cloud_cover: 22,
        },
      },
    },
    {
      hour: 12,
      temperature: 22,
      wind_speed: 14,
      wind_gust: 20,
      wind_direction: 230,
      precipitation: 0,
      cloud_cover: 15,
      cape: 900,
      para_index: 82,
      verdict: 'bon',
      thermal_strength: 'fort',
      sources: {
        'open-meteo': {
          temperature: 22.1,
          wind_speed: 13.8,
          wind_gust: 19.5,
          wind_direction: 225,
          precipitation: 0,
          cloud_cover: 12,
        },
        weatherapi: {
          temperature: 21.9,
          wind_speed: 14.2,
          wind_gust: 20.5,
          wind_direction: 235,
          precipitation: 0,
          cloud_cover: 18,
        },
      },
    },
    {
      hour: 14,
      temperature: 24,
      wind_speed: 15,
      wind_gust: 22,
      wind_direction: 240,
      precipitation: 0,
      cloud_cover: 25,
      cape: 1100,
      para_index: 75,
      verdict: 'bon',
      thermal_strength: 'fort',
      sources: {
        'open-meteo': {
          temperature: 24.2,
          wind_speed: 14.8,
          wind_gust: 21.5,
          wind_direction: 235,
          precipitation: 0,
          cloud_cover: 22,
        },
        weatherapi: {
          temperature: 23.8,
          wind_speed: 15.2,
          wind_gust: 22.5,
          wind_direction: 245,
          precipitation: 0,
          cloud_cover: 28,
        },
      },
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
  explanation: 'Conditions moyennes, vent soutenu',
  slots_summary: 'Vol possible avec prudence',
  sunrise: '06:30',
  sunset: '21:00',
  metrics: {
    avg_temp_c: 16,
    avg_wind_kmh: 20,
    max_gust_kmh: 28,
    total_rain_mm: 0,
  },
  consensus: [
    {
      hour: 10,
      temperature: 16,
      wind_speed: 20,
      wind_gust: 28,
      wind_direction: 270,
      precipitation: 0,
      cloud_cover: 45,
      cape: 300,
      para_index: 55,
      verdict: 'moyen',
      thermal_strength: 'faible',
      sources: {
        'open-meteo': {
          temperature: 16.1,
          wind_speed: 19.8,
          wind_gust: 27.5,
          wind_direction: 265,
          precipitation: 0,
          cloud_cover: 42,
        },
        weatherapi: {
          temperature: 15.9,
          wind_speed: 20.2,
          wind_gust: 28.5,
          wind_direction: 275,
          precipitation: 0,
          cloud_cover: 48,
        },
      },
    },
  ],
};

const mockDailySummary = {
  site_id: 'site-arguel',
  site_name: 'Arguel',
  days: [
    {
      day_index: 0,
      date: '2025-06-15',
      para_index: 78,
      verdict: 'bon',
      emoji: '🟢',
      temp_min: 14,
      temp_max: 24,
      wind_avg: 12,
    },
    {
      day_index: 1,
      date: '2025-06-16',
      para_index: 85,
      verdict: 'bon',
      emoji: '🟢',
      temp_min: 15,
      temp_max: 26,
      wind_avg: 10,
    },
    {
      day_index: 2,
      date: '2025-06-17',
      para_index: 60,
      verdict: 'moyen',
      emoji: '🟡',
      temp_min: 13,
      temp_max: 22,
      wind_avg: 18,
    },
    {
      day_index: 3,
      date: '2025-06-18',
      para_index: 45,
      verdict: 'limite',
      emoji: '🟠',
      temp_min: 11,
      temp_max: 19,
      wind_avg: 25,
    },
    {
      day_index: 4,
      date: '2025-06-19',
      para_index: 30,
      verdict: 'mauvais',
      emoji: '🔴',
      temp_min: 9,
      temp_max: 16,
      wind_avg: 32,
    },
    {
      day_index: 5,
      date: '2025-06-20',
      para_index: 70,
      verdict: 'moyen',
      emoji: '🟡',
      temp_min: 12,
      temp_max: 21,
      wind_avg: 16,
    },
    {
      day_index: 6,
      date: '2025-06-21',
      para_index: 82,
      verdict: 'bon',
      emoji: '🟢',
      temp_min: 14,
      temp_max: 25,
      wind_avg: 11,
    },
  ],
};

const mockEmagramHours = {
  site_id: '07280',
  forecast_date: '2025-06-15',
  hours: [
    { hour: 9, score: 45, status: 'completed', id: 'emagram-h9' },
    { hour: 12, score: 72, status: 'completed', id: 'emagram-h12' },
    { hour: 15, score: 85, status: 'completed', id: 'emagram-h15' },
  ],
};

const mockLandingAssociations = [
  {
    id: 'assoc-1',
    takeoff_site_id: 'site-arguel',
    landing_site_id: 'site-plaine',
    is_primary: true,
    distance_km: 1.34,
    notes: null,
    landing_site: {
      id: 'site-plaine',
      name: "Plaine d'Arguel",
      latitude: 47.19,
      longitude: 5.99,
      elevation_m: 250,
      country: 'FR',
      usage_type: 'landing' as const,
      flight_count: 0,
      is_active: true,
    },
    created_at: '2025-06-10T10:00:00',
  },
];

const mockLandingWeather = [
  {
    landing_site_id: 'site-plaine',
    landing_site_name: "Plaine d'Arguel",
    distance_km: 1.34,
    is_primary: true,
    weather: {
      consensus: [],
      para_index: 80,
      verdict: 'bon',
      emoji: '🟢',
      sunrise: '06:30',
      sunset: '21:00',
    },
  },
];

const defaultHandlers = [
  http.get('*/api/spots', () => HttpResponse.json(mockSites)),
  http.get('*/api/spots/:id', ({ params }) => {
    const site = mockSites.sites.find((s) => s.id === params.id);
    return site
      ? HttpResponse.json(site)
      : new HttpResponse(null, { status: 404 });
  }),
  http.get('*/api/weather/site-arguel', () =>
    HttpResponse.json(mockWeatherArguel)
  ),
  http.get('*/api/weather/site-chalais', () =>
    HttpResponse.json(mockWeatherChalais)
  ),
  http.get('*/api/weather/:spotId/daily-summary', () =>
    HttpResponse.json(mockDailySummary)
  ),
  http.get('*/api/sites/:siteId/landings', () =>
    HttpResponse.json(mockLandingAssociations)
  ),
  http.get('*/api/sites/:siteId/landings/weather', () =>
    HttpResponse.json(mockLandingWeather)
  ),
  http.get('*/api/emagram/hours', () => HttpResponse.json(mockEmagramHours)),
  http.get('*/api/emagram/latest', () => HttpResponse.json(null)),
  http.get('*/api/emagram/history', () => HttpResponse.json([])),
];

const weatherRouteConfig = {
  initialPath: '/weather',
  routes: [
    {
      path: '/weather',
      element: 'story' as const,
      validateSearch: (search: Record<string, unknown>) => ({
        siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
      }),
    },
  ],
};

export const Default = meta.story({
  name: 'Default',
  parameters: {
    router: weatherRouteConfig,
    msw: { handlers: defaultHandlers },
  },
});

Default.test(
  'renders weather page with site selector and conditions',
  async ({ canvas }) => {
    await canvas.findByText('Arguel');
    await expect(canvas.getByText('Chalais')).toBeInTheDocument();
  }
);

export const WithSelectedSite = meta.story({
  name: 'With Selected Site (Chalais)',
  parameters: {
    router: {
      ...weatherRouteConfig,
      initialPath: '/weather?siteId=site-chalais',
    },
    msw: { handlers: defaultHandlers },
  },
});

WithSelectedSite.test(
  'renders weather for the selected site',
  async ({ canvas }) => {
    await canvas.findByText('Chalais');
    await expect(canvas.getByText('Arguel')).toBeInTheDocument();
  }
);

export const NoSites = meta.story({
  name: 'No Sites',
  parameters: {
    router: weatherRouteConfig,
    msw: {
      handlers: [
        http.get('*/api/spots', () => HttpResponse.json({ sites: [] })),
        ...defaultHandlers.slice(1),
      ],
    },
  },
});

NoSites.test('shows no sites message', async ({ canvas }) => {
  await canvas.findByText(/Aucun site configuré/);
});

export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    router: weatherRouteConfig,
    msw: {
      handlers: [
        http.get('*/api/spots', async () => {
          await new Promise(() => {});
        }),
        ...defaultHandlers.slice(1),
      ],
    },
  },
});

export const WeatherError = meta.story({
  name: 'Weather Error',
  parameters: {
    router: weatherRouteConfig,
    msw: {
      handlers: [
        http.get('*/api/spots', () => HttpResponse.json(mockSites)),
        http.get('*/api/spots/:id', ({ params }) => {
          const site = mockSites.sites.find((s) => s.id === params.id);
          return site
            ? HttpResponse.json(site)
            : new HttpResponse(null, { status: 404 });
        }),
        http.get(
          '*/api/weather/:spotId',
          () => new HttpResponse(null, { status: 500 })
        ),
        http.get(
          '*/api/weather/:spotId/daily-summary',
          () => new HttpResponse(null, { status: 500 })
        ),
        http.get('*/api/sites/:siteId/landings', () => HttpResponse.json([])),
        http.get('*/api/sites/:siteId/landings/weather', () =>
          HttpResponse.json([])
        ),
        http.get('*/api/emagram/hours', () =>
          HttpResponse.json(mockEmagramHours)
        ),
        http.get('*/api/emagram/latest', () => HttpResponse.json(null)),
        http.get('*/api/emagram/history', () => HttpResponse.json([])),
      ],
    },
  },
});

WeatherError.test(
  'renders site selector even when weather fails',
  async ({ canvas }) => {
    await canvas.findByText('Arguel');
    await expect(canvas.getByText('Chalais')).toBeInTheDocument();
  }
);

export const SingleSite = meta.story({
  name: 'Single Site',
  parameters: {
    router: weatherRouteConfig,
    msw: {
      handlers: [
        http.get('*/api/spots', () =>
          HttpResponse.json({ sites: [mockSites.sites[0]] })
        ),
        http.get('*/api/spots/:id', () =>
          HttpResponse.json(mockSites.sites[0])
        ),
        ...defaultHandlers.slice(2),
      ],
    },
  },
});

SingleSite.test('renders with a single site', async ({ canvas }) => {
  await canvas.findByText('Arguel');
});
