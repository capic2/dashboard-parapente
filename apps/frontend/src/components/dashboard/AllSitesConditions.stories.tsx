import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import preview from '../../../.storybook/preview';
import AllSitesConditions from './AllSitesConditions';
import { expect } from 'storybook/test';

// Fixed hour for deterministic mock data
const fixedHour = 10;

const mockSites = [
  {
    id: 'site-1',
    name: 'Arguel',
    code: 'arguel',
    orientation: 'NW',
    latitude: 47.22,
    longitude: 6.02,
    elevation_m: 720,
    country: 'FR',
    is_active: true,
  },
  {
    id: 'site-2',
    name: 'Mont Poupet Sud',
    code: 'mont-poupet-sud',
    orientation: 'S',
    latitude: 46.92,
    longitude: 5.85,
    elevation_m: 850,
    country: 'FR',
    is_active: true,
  },
  {
    id: 'site-3',
    name: 'La Côte',
    code: 'la-cote',
    orientation: 'W',
    latitude: 46.88,
    longitude: 5.95,
    elevation_m: 600,
    country: 'FR',
    is_active: true,
  },
];

const makeWeatherResponse = (
  siteId: string,
  siteName: string,
  paraIndex: number,
  verdict: string,
  temp: number,
  windSpeed: number,
  windDir: number,
  windGust: number,
  cloudCover: number
) => ({
  site_id: siteId,
  site_name: siteName,
  day_index: 0,
  days: 1,
  para_index: paraIndex,
  verdict,
  emoji: verdict === 'bon' ? '🟢' : verdict === 'moyen' ? '🟡' : '🔴',
  explanation: `Conditions ${verdict}`,
  consensus: [
    {
      hour: fixedHour,
      temperature: temp,
      wind_speed: windSpeed,
      wind_gust: windGust,
      wind_direction: windDir,
      precipitation: verdict === 'mauvais' ? 3 : 0,
      cloud_cover: cloudCover,
      para_index: paraIndex,
      verdict,
    },
  ],
});

const defaultHandlers = [
  http.get('*/api/spots', () => HttpResponse.json({ sites: mockSites })),
  http.get('*/api/weather/site-1', () =>
    HttpResponse.json(
      makeWeatherResponse('site-1', 'Arguel', 82, 'bon', 22, 12, 315, 18, 15)
    )
  ),
  http.get('*/api/weather/site-2', () =>
    HttpResponse.json(
      makeWeatherResponse(
        'site-2',
        'Mont Poupet Sud',
        55,
        'moyen',
        18,
        22,
        180,
        30,
        55
      )
    )
  ),
  http.get('*/api/weather/site-3', () =>
    HttpResponse.json(
      makeWeatherResponse(
        'site-3',
        'La Côte',
        28,
        'mauvais',
        12,
        35,
        90,
        45,
        85
      )
    )
  ),
  http.get('*/api/spots/:id', ({ params }) => {
    const site = mockSites.find((s) => s.id === params.id);
    return site
      ? HttpResponse.json(site)
      : new HttpResponse(null, { status: 404 });
  }),
];

const meta = preview.meta({
  title: 'Components/Dashboard/AllSitesConditions',
  component: AllSitesConditions,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
            staleTime: 0,
          },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '900px' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Grid of all configured sites showing current weather conditions. Auto-refreshes every hour. Click a card to navigate to the weather detail page.',
      },
    },
  },
  tags: ['autodocs'],
});

// Default with 3 sites - varied conditions
export const Default = meta.story({
  name: 'Default (3 Sites)',
  parameters: {
    msw: {
      handlers: defaultHandlers,
    },
  },
});

Default.test('displays all site cards', async ({ canvas }) => {
  await canvas.findByText('Arguel');
  await expect(canvas.getByText('Mont Poupet Sud')).toBeInTheDocument();
  await expect(canvas.getByText('La Côte')).toBeInTheDocument();
});

// Loading state
export const Loading = meta.story({
  name: 'Loading',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots', () => HttpResponse.json({ sites: mockSites })),
        http.get('*/api/weather/:spotId', async () => {
          await new Promise(() => {}); // Never resolves
        }),
        http.get('*/api/spots/:id', ({ params }) => {
          const site = mockSites.find((s) => s.id === params.id);
          return site
            ? HttpResponse.json(site)
            : new HttpResponse(null, { status: 404 });
        }),
      ],
    },
  },
});

// Single site
export const SingleSite = meta.story({
  name: 'Single Site',
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots', () =>
          HttpResponse.json({ sites: [mockSites[0]] })
        ),
        http.get('*/api/weather/site-1', () =>
          HttpResponse.json(
            makeWeatherResponse(
              'site-1',
              'Arguel',
              82,
              'bon',
              22,
              12,
              315,
              18,
              15
            )
          )
        ),
        http.get('*/api/spots/:id', () => HttpResponse.json(mockSites[0])),
      ],
    },
  },
});
