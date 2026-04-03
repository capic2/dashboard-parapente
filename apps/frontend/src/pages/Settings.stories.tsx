import { http, HttpResponse } from 'msw';
import { userEvent, within, expect } from 'storybook/test';
import preview from '../../.storybook/preview';
import Settings from './Settings';
import { useCacheSettingsStore } from '../stores/cacheSettingsStore';

const meta = preview.meta({
  title: 'Pages/Settings',
  component: Settings,
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

const mockSettings = {
  cache_ttl_default: '3600',
  cache_ttl_summary: '3600',
  scheduler_interval_minutes: '30',
  redis_connect_timeout: '5',
  redis_socket_timeout: '5',
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
  http.get('*/api/settings', () => HttpResponse.json(mockSettings)),
  http.put('*/api/settings', async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    return HttpResponse.json({ success: true, updated: body });
  }),
];

export const Default = meta.story({
  name: 'Default',
  parameters: { msw: { handlers: defaultHandlers } },
});

Default.test('renders settings page', async ({ canvas }) => {
  await canvas.findByText(/Param/);
});

Default.test(
  'renders performance section with all controls',
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Should render the section title
    await canvas.findByText(/Données et Performance/);

    // Should render browser sub-section controls
    await canvas.findByText(/Temps réel/);
    await canvas.findByText(/Normal/);
    await canvas.findByText(/Économie/);

    // Should render auto-refresh toggle
    await canvas.findByText(/Rafraîchissement automatique de la météo/);

    // Should render timeout buttons
    await canvas.findByText(/15 sec/);
    await canvas.findByText(/30 sec/);
    await canvas.findByText(/60 sec/);

    // Should render server sub-section controls
    await canvas.findByText(/Durée du cache serveur/);
    await canvas.findByText(/Fréquence de collecte automatique/);
  }
);

Default.test(
  'clicking economy updates freshness level',
  async ({ canvasElement }) => {
    // Reset store
    useCacheSettingsStore.setState({
      freshnessLevel: 'normal',
      autoRefreshWeather: true,
      httpTimeout: 30000,
    });

    const canvas = within(canvasElement);
    const economyButton = await canvas.findByText(/Économie/);
    await userEvent.click(economyButton);

    await expect(useCacheSettingsStore.getState().freshnessLevel).toBe(
      'economy'
    );
  }
);

Default.test(
  'toggling auto-refresh updates store',
  async ({ canvasElement }) => {
    useCacheSettingsStore.setState({ autoRefreshWeather: true });

    const canvas = within(canvasElement);
    // Find the checkbox in the auto-refresh section
    await canvas.findByText(/Rafraîchissement automatique de la météo/);
    const checkboxes = canvasElement.querySelectorAll('input[type="checkbox"]');
    // The auto-refresh checkbox is in the performance section (after notification checkboxes)
    const autoRefreshCheckbox = Array.from(
      checkboxes
    ).pop() as HTMLInputElement;
    if (autoRefreshCheckbox) {
      await userEvent.click(autoRefreshCheckbox);
      await expect(useCacheSettingsStore.getState().autoRefreshWeather).toBe(
        false
      );
    }
  }
);

Default.test(
  'clicking 60s timeout updates store',
  async ({ canvasElement }) => {
    useCacheSettingsStore.setState({ httpTimeout: 30000 });

    const canvas = within(canvasElement);
    const timeoutButton = await canvas.findByText('60 sec');
    await userEvent.click(timeoutButton);

    await expect(useCacheSettingsStore.getState().httpTimeout).toBe(60000);
  }
);

export const Loading = meta.story({
  name: 'Loading',
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
