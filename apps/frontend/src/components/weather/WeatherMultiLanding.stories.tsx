import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import preview from '../../../.storybook/preview';
import { expect } from 'storybook/test';
import WeatherMultiLanding from './WeatherMultiLanding';

const meta = preview.meta({
  title: 'Components/Weather/WeatherMultiLanding',
  component: WeatherMultiLanding,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '800px', padding: '1rem' }}>
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



// Mock associations
const mockAssociations = [
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
    created_at: '2026-03-20T10:00:00',
  },
  {
    id: 'assoc-2',
    takeoff_site_id: 'site-arguel',
    landing_site_id: 'site-secours',
    is_primary: false,
    distance_km: 2.1,
    notes: null,
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
  {
    id: 'assoc-3',
    takeoff_site_id: 'site-arguel',
    landing_site_id: 'site-vallee',
    is_primary: false,
    distance_km: 4.8,
    notes: null,
    landing_site: {
      id: 'site-vallee',
      name: 'Fond de Vallee',
      latitude: 47.17,
      longitude: 5.97,
      elevation_m: 210,
      country: 'FR',
      usage_type: 'landing' as const,
      flight_count: 0,
      is_active: true,
    },
    created_at: '2026-03-20T10:10:00',
  },
];

// Mock weather data
const mockWeatherGood = [
  {
    landing_site_id: 'site-plaine',
    landing_site_name: "Plaine d'Arguel",
    distance_km: 1.34,
    is_primary: true,
    weather: {
      consensus: [],
      para_index: 85,
      verdict: 'bon',
      emoji: '🟢',
      sunrise: '06:45',
      sunset: '19:30',
    },
  },
  {
    landing_site_id: 'site-secours',
    landing_site_name: 'Terrain de secours',
    distance_km: 2.1,
    is_primary: false,
    weather: {
      consensus: [],
      para_index: 65,
      verdict: 'moyen',
      emoji: '🟡',
      sunrise: '06:45',
      sunset: '19:30',
    },
  },
  {
    landing_site_id: 'site-vallee',
    landing_site_name: 'Fond de Vallee',
    distance_km: 4.8,
    is_primary: false,
    weather: {
      consensus: [],
      para_index: 40,
      verdict: 'limite',
      emoji: '🟠',
      sunrise: '06:45',
      sunset: '19:30',
    },
  },
];

const mockWeatherAllGood = mockWeatherGood.map((entry) => ({
  ...entry,
  weather: {
    ...entry.weather,
    para_index: 85 + Math.floor(Math.random() * 10),
    verdict: 'bon',
    emoji: '🟢',
  },
}));

const mockWeatherAllBad = mockWeatherGood.map((entry) => ({
  ...entry,
  weather: {
    ...entry.weather,
    para_index: 15 + Math.floor(Math.random() * 10),
    verdict: 'mauvais',
    emoji: '🔴',
  },
}));

const mockWeatherWithError = [
  mockWeatherGood[0],
  {
    ...mockWeatherGood[1],
    weather: { error: 'Impossible de recuperer la meteo pour ce site' },
  },
  mockWeatherGood[2],
];

// Story: Mixed conditions (bon, moyen, limite)
export const MixedConditions = meta.story({
  name: 'Mixed Conditions',
  args: {
    spotId: 'site-arguel',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', () => {
          return HttpResponse.json(mockAssociations);
        }),
        http.get('*/api/sites/:siteId/landings/weather', () => {
          return HttpResponse.json(mockWeatherGood);
        }),
      ],
    },
  },
});

MixedConditions.test(
  'displays weather cards for all landings',
  async ({ canvas }) => {
    await canvas.findByText("Plaine d'Arguel");
    await expect(canvas.getByText('Terrain de secours')).toBeInTheDocument();
    await expect(canvas.getByText('Fond de Vallee')).toBeInTheDocument();
    await expect(canvas.getByText('1.34 km')).toBeInTheDocument();
    await expect(canvas.getByText('2.1 km')).toBeInTheDocument();
    await expect(canvas.getByText('4.8 km')).toBeInTheDocument();
    await expect(canvas.getByText('Principal')).toBeInTheDocument();
  }
);

// Story: All good conditions
export const AllGoodConditions = meta.story({
  name: 'All Good Conditions',
  args: {
    spotId: 'site-arguel',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', () => {
          return HttpResponse.json(mockAssociations);
        }),
        http.get('*/api/sites/:siteId/landings/weather', () => {
          return HttpResponse.json(mockWeatherAllGood);
        }),
      ],
    },
  },
});

// Story: All bad conditions
export const AllBadConditions = meta.story({
  name: 'All Bad Conditions',
  args: {
    spotId: 'site-arguel',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', () => {
          return HttpResponse.json(mockAssociations);
        }),
        http.get('*/api/sites/:siteId/landings/weather', () => {
          return HttpResponse.json(mockWeatherAllBad);
        }),
      ],
    },
  },
});

// Story: With weather error on one landing
export const WithWeatherError = meta.story({
  name: 'With Weather Error',
  args: {
    spotId: 'site-arguel',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', () => {
          return HttpResponse.json(mockAssociations);
        }),
        http.get('*/api/sites/:siteId/landings/weather', () => {
          return HttpResponse.json(mockWeatherWithError);
        }),
      ],
    },
  },
});

WithWeatherError.test(
  'shows error message for failed weather',
  async ({ canvas }) => {
    await canvas.findByText("Plaine d'Arguel");
    await expect(
      canvas.getByText('Impossible de recuperer la meteo pour ce site')
    ).toBeInTheDocument();
  }
);

// Story: Single landing
export const SingleLanding = meta.story({
  name: 'Single Landing',
  args: {
    spotId: 'site-arguel',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', () => {
          return HttpResponse.json([mockAssociations[0]]);
        }),
        http.get('*/api/sites/:siteId/landings/weather', () => {
          return HttpResponse.json([mockWeatherGood[0]]);
        }),
      ],
    },
  },
});

// Story: No associations (renders nothing)
export const NoAssociations = meta.story({
  name: 'No Associations',
  args: {
    spotId: 'site-arguel',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', () => {
          return HttpResponse.json([]);
        }),
        http.get('*/api/sites/:siteId/landings/weather', () => {
          return HttpResponse.json([]);
        }),
      ],
    },
  },
});

// Story: Loading state
export const Loading = meta.story({
  name: 'Loading',
  args: {
    spotId: 'site-arguel',
    dayIndex: 0,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/sites/:siteId/landings', () => {
          return HttpResponse.json(mockAssociations);
        }),
        http.get('*/api/sites/:siteId/landings/weather', async () => {
          await new Promise(() => {}); // Never resolves
        }),
      ],
    },
  },
});
