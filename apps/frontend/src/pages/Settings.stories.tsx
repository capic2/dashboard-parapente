import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import preview from '../../.storybook/preview';
import Settings from './Settings';

const meta = preview.meta({
  title: 'Pages/Settings',
  component: Settings,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});

export default meta;

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
  ],
};

const mockWeatherSources = [
  {
    id: 'ws-1',
    source_name: 'open-meteo',
    display_name: 'Open-Meteo',
    description: 'Open-source free weather API',
    is_enabled: true,
    requires_api_key: false,
    api_key: null,
    priority: 10,
    scraper_type: 'api',
    base_url: 'https://api.open-meteo.com/v1/forecast',
  },
  {
    id: 'ws-2',
    source_name: 'weatherapi',
    display_name: 'WeatherAPI.com',
    description: 'Commercial weather API',
    is_enabled: true,
    requires_api_key: true,
    api_key: 'test_key',
    priority: 9,
    scraper_type: 'api',
    base_url: 'https://api.weatherapi.com/v1/forecast.json',
  },
  {
    id: 'ws-3',
    source_name: 'meteo-parapente',
    display_name: 'Meteo Parapente',
    description: 'Paragliding-specific weather',
    is_enabled: false,
    requires_api_key: false,
    api_key: null,
    priority: 8,
    scraper_type: 'playwright',
    base_url: 'https://meteo-parapente.com',
  },
];

const mockWeatherStats = {
  total_sources: 3,
  active_sources: 2,
  disabled_sources: 1,
  sources_with_errors: 0,
  global_success_rate: 95.5,
  global_avg_response_time_ms: 450,
};

const defaultHandlers = [
  http.get('*/api/spots', () => HttpResponse.json(mockSites)),
  http.get('*/api/weather-sources', () =>
    HttpResponse.json(mockWeatherSources)
  ),
  http.get('*/api/weather-sources/stats', () =>
    HttpResponse.json(mockWeatherStats)
  ),
  http.patch('*/api/weather-sources/:name', async ({ params }) => {
    const source = mockWeatherSources.find(
      (s) => s.source_name === params.name
    );
    return HttpResponse.json(source || mockWeatherSources[0]);
  }),
  http.delete('*/api/weather-sources/:name', () =>
    HttpResponse.json({ success: true, message: 'Source deleted' })
  ),
];

export const Default = meta.story({
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test('renders settings page', async ({ canvas }) => {
  await canvas.findByText(/Param/);
});

export const Loading = meta.story({
  parameters: {
    msw: {
      handlers: [
        http.get('*/api/spots', async () => {
          await new Promise(() => {});
        }),
        http.get('*/api/weather-sources', async () => {
          await new Promise(() => {});
        }),
        http.get('*/api/weather-sources/stats', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});
