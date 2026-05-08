import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import { expect, screen, waitFor } from 'storybook/test';
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

const mockLocationSearch = {
  query: 'Besan',
  locations: [
    {
      id: 'osm-besancon',
      name: 'Besançon',
      display_name: 'Besançon, Doubs, Bourgogne-Franche-Comté, France',
      latitude: 47.238,
      longitude: 6.024,
      country: 'FR',
    },
  ],
};

const mockNearbyFlightOptions = {
  city_option: mockLocationSearch.locations[0],
  radius_km: 30,
  limit: 5,
  takeoffs: [
    {
      id: 'merged-takeoff-arguel',
      name: 'Arguel déco',
      type: 'takeoff' as const,
      latitude: 47.205,
      longitude: 6.005,
      elevation_m: 427,
      orientation: 'SW',
      rating: 4,
      country: 'FR',
      source: 'merged',
      distance_km: 4.9,
    },
  ],
  landings: [
    {
      id: 'merged-landing-arguel',
      name: "Plaine d'Arguel",
      type: 'landing' as const,
      latitude: 47.19,
      longitude: 5.99,
      elevation_m: 250,
      orientation: null,
      rating: 3,
      country: 'FR',
      source: 'merged',
      distance_km: 5.8,
    },
  ],
};

const mockCreatedSearchSite = {
  id: 'site-search-arguel',
  code: 'ARG-SEARCH',
  name: 'Arguel déco',
  latitude: 47.205,
  longitude: 6.005,
  elevation_m: 427,
  region: 'Doubs',
  country: 'FR',
  orientation: 'SW',
  usage_type: 'takeoff',
  flight_count: 0,
  is_active: true,
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
  reason: 'Bonnes conditions pour le vol.',
  flyableSlot: '10h-17h',
  thermalCeiling: 1850,
  cached_at: '2025-06-15T08:30:00Z',
};

const mockBestSpotByDay: Record<number, typeof mockBestSpot> = {
  0: mockBestSpot,
  1: {
    ...mockBestSpot,
    score: 74,
    paraIndex: 74,
    reason: 'Prévisions stables demain.',
  },
  2: {
    ...mockBestSpot,
    score: 60,
    paraIndex: 60,
    reason: 'Conditions moyennes.',
  },
};

const mockLiveWindArguel = {
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
  ],
};

const mockLiveWindChalais = {
  site_id: 'site-chalais',
  site_name: 'Chalais',
  source: 'spotair' as const,
  radius_km: 10,
  stations: [
    {
      id: 'ffvl_9999',
      provider: 'ffvl',
      provider_id: '9999',
      name: 'Chalais Ouest',
      latitude: 47.18,
      longitude: 6.21,
      altitude_m: 870,
      distance_km: 0.9,
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

const spotsHandler = http.get('*/api/spots', () => HttpResponse.json(mockSites));
const createSpotHandler = http.post('*/api/spots', () =>
  HttpResponse.json(mockCreatedSearchSite)
);
const locationsSearchHandler = http.get('*/api/locations/search', () =>
  HttpResponse.json(mockLocationSearch)
);
const nearbyFlightOptionsHandler = http.get(
  '*/api/locations/nearby-flight-options',
  () => HttpResponse.json(mockNearbyFlightOptions)
);
const coordinatesWeatherHandler = http.get('*/api/weather/coordinates', () =>
  HttpResponse.json({
    ...mockWeatherArguel,
    site_id: 'coordinates',
    site_name: 'Besançon',
  })
);
const spotWeatherHandler = http.get('*/api/spots/weather/:spotId', () =>
  HttpResponse.json({
    ...mockWeatherArguel,
    spot_id: 'merged-takeoff-arguel',
    spot_name: 'Arguel déco',
  })
);
const bestSpotsHandler = http.get('*/api/spots/best', ({ request }) => {
  const dayIndex = Number(
    new URL(request.url).searchParams.get('day_index') || '0'
  );

  return HttpResponse.json(mockBestSpotByDay[dayIndex] ?? mockBestSpot);
});
const hourlyBestSpotsHandler = http.get(
  '*/api/spots/best/hourly',
  ({ request }) => {
    const url = new URL(request.url);
    const dayIndex = Number(url.searchParams.get('day_index') || '0');
    const hours = Number(url.searchParams.get('hours') || '24');
    const bestSpot = mockBestSpotByDay[dayIndex] ?? mockBestSpot;

    return HttpResponse.json({
      dayIndex,
      startHour: 9,
      hours: Array.from({ length: Math.min(hours, 3) }, (_, index) => ({
        ...bestSpot,
        hour: 9 + index,
      })),
    });
  }
);
const spotDetailsHandler = http.get('*/api/spots/:id', ({ params }) => {
  const site = [...mockSites.sites, mockCreatedSearchSite].find(
    (s) => s.id === params.id
  );
  return site
    ? HttpResponse.json(site)
    : new HttpResponse(null, { status: 404 });
});
const weatherArguelHandler = http.get('*/api/weather/site-arguel', () =>
  HttpResponse.json(mockWeatherArguel)
);
const weatherChalaisHandler = http.get('*/api/weather/site-chalais', () =>
  HttpResponse.json(mockWeatherChalais)
);
const weatherSearchFavoriteHandler = http.get(
  '*/api/weather/site-search-arguel',
  () =>
    HttpResponse.json({
      ...mockWeatherArguel,
      site_id: 'site-search-arguel',
      site_name: 'Arguel déco',
    })
);
const dailySummaryHandler = http.get('*/api/weather/:spotId/daily-summary', () =>
  HttpResponse.json(mockDailySummary)
);
const liveWindArguelHandler = http.get('*/api/sites/site-arguel/live-wind', () =>
  HttpResponse.json(mockLiveWindArguel)
);
const liveWindChalaisHandler = http.get(
  '*/api/sites/site-chalais/live-wind',
  () => HttpResponse.json(mockLiveWindChalais)
);
const landingsHandler = http.get('*/api/sites/:siteId/landings', () =>
  HttpResponse.json(mockLandingAssociations)
);
const landingWeatherHandler = http.get(
  '*/api/sites/:siteId/landings/weather',
  () => HttpResponse.json(mockLandingWeather)
);
const emagramHoursHandler = http.get('*/api/emagram/hours', () =>
  HttpResponse.json(mockEmagramHours)
);
const emagramLatestHandler = http.get('*/api/emagram/latest', () =>
  HttpResponse.json(null)
);
const emagramHistoryHandler = http.get('*/api/emagram/history', () =>
  HttpResponse.json([])
);

const defaultHandlers = [
  spotsHandler,
  createSpotHandler,
  locationsSearchHandler,
  nearbyFlightOptionsHandler,
  coordinatesWeatherHandler,
  spotWeatherHandler,
  hourlyBestSpotsHandler,
  bestSpotsHandler,
  spotDetailsHandler,
  weatherArguelHandler,
  weatherChalaisHandler,
  weatherSearchFavoriteHandler,
  dailySummaryHandler,
  liveWindArguelHandler,
  liveWindChalaisHandler,
  landingsHandler,
  landingWeatherHandler,
  emagramHoursHandler,
  emagramLatestHandler,
  emagramHistoryHandler,
];

const defaultHandlersWithoutSpots = defaultHandlers.filter(
  (handler) => handler !== spotsHandler
);

const defaultHandlersWithoutSpotsAndDetails = defaultHandlers.filter(
  (handler) => handler !== spotsHandler && handler !== spotDetailsHandler
);

const weatherRouteConfig = {
  initialPath: '/weather',
  routes: [
    {
      path: '/weather',
      element: 'story' as const,
      validateSearch: (search: Record<string, unknown>) => {
        const rawDay = search.day;
        const parsedDay =
          typeof rawDay === 'string' || typeof rawDay === 'number'
            ? Number(rawDay)
            : Number.NaN;

        return {
          siteId: typeof search.siteId === 'string' ? search.siteId : undefined,
          day:
            Number.isInteger(parsedDay) && parsedDay >= 0 && parsedDay <= 6
              ? parsedDay
              : undefined,
        };
      },
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
  async ({ canvas, userEvent }) => {
    await canvas.findAllByText('Arguel');
    await canvas.findAllByText('Chalais');
    await canvas.findByText(
      /Meilleur spot pour aujourd'hui|Best spot for today/
    );

    const tomorrowButton = await canvas.findByRole('button', {
      name: /\b85\b/,
    });
    await userEvent.click(tomorrowButton);

    await canvas.findByText(/Meilleur spot pour demain|Best spot for tomorrow/);
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
    await canvas.findAllByText('Chalais');
    await canvas.findAllByText('Arguel');
    await canvas.findByText(/Best spot for|Meilleur spot pour/);
  }
);

export const WithCitySearch = meta.story({
  name: 'With City Search',
  parameters: {
    router: weatherRouteConfig,
    msw: { handlers: defaultHandlers },
  },
});

WithCitySearch.test(
  'selects a searched spot, displays hourly details, and adds it to favorites',
  async ({ canvas, userEvent }) => {
    const searchTab = await canvas.findByRole('tab', { name: 'Recherche' });
    await userEvent.click(searchTab);
    const input = await canvas.findByPlaceholderText(/Besançon/);
    await userEvent.type(input, 'Besan');
    const suggestion = await screen.findByRole('option', { name: /Besançon/ });
    await userEvent.click(suggestion);
    const searchedSpotButton = await canvas.findByRole('button', {
      name: /Arguel déco/,
    });
    await canvas.findByRole('button', { name: /Plaine d'Arguel/ });

    await userEvent.click(searchedSpotButton);
    await canvas.findByText('Résultat de recherche sélectionné');
    await canvas.findByText('Météo sélectionnée');
    await canvas.findByText('Prévisions Horaires');

    const addFavoriteButton = await canvas.findByRole('button', {
      name: /Ajouter aux favoris/,
    });
    await userEvent.click(addFavoriteButton);
    await waitFor(() => {
      expect(
        canvas.queryByRole('button', { name: /Ajouter aux favoris/ })
      ).not.toBeInTheDocument();
    });
  }
);

export const NoSites = meta.story({
  name: 'No Sites',
  parameters: {
    router: weatherRouteConfig,
    msw: {
      handlers: [
        http.get('*/api/spots', () => HttpResponse.json({ sites: [] })),
        ...defaultHandlersWithoutSpots,
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
        ...defaultHandlersWithoutSpots,
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
        hourlyBestSpotsHandler,
        http.get('*/api/spots/best', () => HttpResponse.json(mockBestSpot)),
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
        http.get('*/api/sites/:siteId/live-wind', ({ params }) =>
          HttpResponse.json({
            site_id: String(params.siteId),
            site_name: 'Unknown',
            source: 'spotair',
            radius_km: 10,
            stations: [],
          })
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
    await canvas.findAllByText('Arguel');
    await canvas.findAllByText('Chalais');
    await canvas.findByText(/Best spot for|Meilleur spot pour/);
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
        ...defaultHandlersWithoutSpotsAndDetails,
      ],
    },
  },
});

SingleSite.test('renders with a single site', async ({ canvas }) => {
  await canvas.findAllByText('Arguel');
});
