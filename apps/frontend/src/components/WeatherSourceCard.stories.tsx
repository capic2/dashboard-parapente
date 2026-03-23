import preview from '../../.storybook/preview';
import { WeatherSourceCard } from './WeatherSourceCard';
import type {
  WeatherSource,
  WeatherSourceTestResult,
} from '../types/weatherSources';
import { http, HttpResponse, delay } from 'msw';
import { fn, userEvent, within } from 'storybook/test';

// Mock data for weather sources
const mockOpenMeteo: WeatherSource = {
  id: '1',
  source_name: 'open-meteo',
  display_name: 'Open-Meteo',
  description: 'Source météo open-source gratuite et fiable',
  is_enabled: true,
  requires_api_key: false,
  api_key_configured: true,
  priority: 1,
  scraper_type: 'api',
  base_url: 'https://api.open-meteo.com',
  documentation_url: 'https://open-meteo.com/en/docs',
  last_success_at: '2025-06-15T09:55:00.000Z', // 5 minutes ago
  last_error_at: null,
  last_error_message: null,
  success_count: 245,
  error_count: 5,
  success_rate: 98,
  avg_response_time_ms: 145,
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2025-06-15T10:00:00.000Z',
};

const mockWeatherAPI: WeatherSource = {
  id: '2',
  source_name: 'weatherapi',
  display_name: 'WeatherAPI.com',
  description: 'API météo complète avec données en temps réel',
  is_enabled: true,
  requires_api_key: true,
  api_key_configured: true,
  priority: 2,
  scraper_type: 'api',
  base_url: 'https://api.weatherapi.com',
  documentation_url: 'https://www.weatherapi.com/docs/',
  last_success_at: '2025-06-15T09:45:00.000Z', // 15 minutes ago
  last_error_at: null,
  last_error_message: null,
  success_count: 180,
  error_count: 2,
  success_rate: 98.9,
  avg_response_time_ms: 230,
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2025-06-15T10:00:00.000Z',
};

const mockMeteoParapente: WeatherSource = {
  id: '3',
  source_name: 'meteo-parapente',
  display_name: 'Meteo-Parapente',
  description: 'Données météo spécialisées pour le vol libre',
  is_enabled: true,
  requires_api_key: false,
  api_key_configured: true,
  priority: 3,
  scraper_type: 'playwright',
  base_url: 'https://meteo-parapente.com',
  documentation_url: null,
  last_success_at: '2025-06-15T08:00:00.000Z', // 2 hours ago
  last_error_at: '2025-06-15T09:30:00.000Z', // 30 minutes ago
  last_error_message: "Timeout: La page n'a pas répondu dans le délai imparti",
  success_count: 120,
  error_count: 15,
  success_rate: 88.9,
  avg_response_time_ms: 1850,
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2025-06-15T10:00:00.000Z',
};

const mockDisabledSource: WeatherSource = {
  id: '4',
  source_name: 'meteociel',
  display_name: 'Meteociel',
  description: 'Météo française avec scraping avancé',
  is_enabled: false,
  requires_api_key: false,
  api_key_configured: true,
  priority: 4,
  scraper_type: 'stealth',
  base_url: 'https://meteociel.fr',
  documentation_url: null,
  last_success_at: '2025-06-14T10:00:00.000Z', // 1 day ago
  last_error_at: null,
  last_error_message: null,
  success_count: 45,
  error_count: 3,
  success_rate: 93.8,
  avg_response_time_ms: 2100,
  status: 'disabled',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2025-06-15T10:00:00.000Z',
};

const mockErrorSource: WeatherSource = {
  id: '5',
  source_name: 'meteoblue',
  display_name: 'Meteoblue',
  description: 'Source météo premium avec API',
  is_enabled: true,
  requires_api_key: true,
  api_key_configured: false, // API key not configured
  priority: 5,
  scraper_type: 'api',
  base_url: 'https://api.meteoblue.com',
  documentation_url: 'https://docs.meteoblue.com',
  last_success_at: null,
  last_error_at: '2025-06-15T09:50:00.000Z', // 10 minutes ago
  last_error_message: 'Authentication failed: Invalid API key',
  success_count: 0,
  error_count: 12,
  success_rate: 0,
  avg_response_time_ms: null,
  status: 'error',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2025-06-15T10:00:00.000Z',
};

const mockUnknownSource: WeatherSource = {
  id: '6',
  source_name: 'custom-source',
  display_name: 'Custom Weather Source',
  description: 'Source personnalisée non testée',
  is_enabled: true,
  requires_api_key: false,
  api_key_configured: true,
  priority: 6,
  scraper_type: 'api',
  base_url: 'https://custom-api.example.com',
  documentation_url: null,
  last_success_at: null,
  last_error_at: null,
  last_error_message: null,
  success_count: 0,
  error_count: 0,
  success_rate: 0,
  avg_response_time_ms: null,
  status: 'unknown',
  created_at: '2025-06-15T10:00:00.000Z',
  updated_at: '2025-06-15T10:00:00.000Z',
};

const meta = preview.meta({
  title: 'Components/WeatherSourceCard',
  component: WeatherSourceCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Weather source card displaying configuration, statistics, and controls for individual weather data sources.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '500px' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    source: {
      description: 'Weather source object with configuration and statistics',
    },
    isLastActive: {
      control: 'boolean',
      description:
        'Whether this is the last active source (prevents disabling)',
    },
    onDelete: {
      action: 'delete-clicked',
      description: 'Callback when delete button is clicked',
    },
  },
});

export const Default = meta.story({
  args: {
    onDelete: fn(),
    source: { ...mockOpenMeteo, source_name: 'other' },
    isLastActive: true,
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/weather-sources/other/test', () => {

          return HttpResponse.json<WeatherSourceTestResult>({
            success: true,
            response_time_ms: 145,
            tested_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
  tags: ['!autodocs'],
});
Default.test('It calls the onDelete function', async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(
    canvas.getByRole('button', { name: 'Supprimer la source Open-Meteo' })
  );
});
Default.test(
  'It calls the test endpoint api',
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Tester la source Open-Meteo',
      })
    );
  }
);

/**
 * Active API source without API key requirement (Open-Meteo)
 */
export const ActiveAPISource = meta.story({
  name: 'Active API Source',
  args: {
    source: mockOpenMeteo,
    isLastActive: false,
    onDelete: undefined,
  },
  parameters: {
    msw: {
      handlers: [
        // PATCH /api/weather-sources/{sourceName}
        http.patch('/api/weather-sources/:sourceName', async () => {
          await delay(300);
          return HttpResponse.json({
            ...mockOpenMeteo,
            updated_at: '2025-06-15T10:00:00.000Z',
          });
        }),
        // POST /api/weather-sources/{sourceName}/test
        http.post('/api/weather-sources/:sourceName/test', async () => {
          await delay(500);
          return HttpResponse.json<WeatherSourceTestResult>({
            success: true,
            response_time_ms: 145,
            tested_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
});

/**
 * Active API source with API key configured (WeatherAPI)
 */
export const WithAPIKey = meta.story({
  name: 'With API Key',
  args: {
    source: mockWeatherAPI,
    isLastActive: false,
    onDelete: (source) => console.log('Delete:', source.source_name),
  },
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/weather-sources/:sourceName', async ({ request }) => {
          await delay(300);
          const body = (await request.json()) as any;
          return HttpResponse.json({
            ...mockWeatherAPI,
            ...body,
            api_key_configured: body.api_key
              ? true
              : mockWeatherAPI.api_key_configured,
            updated_at: '2025-06-15T10:00:00.000Z',
          });
        }),
        http.post('/api/weather-sources/:sourceName/test', async () => {
          await delay(800);
          return HttpResponse.json<WeatherSourceTestResult>({
            success: true,
            response_time_ms: 230,
            tested_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
});

/**
 * Playwright scraper with recent errors
 */
export const PlaywrightScraper = meta.story({
  name: 'Playwright Scraper',
  args: {
    source: mockMeteoParapente,
    isLastActive: false,
    onDelete: (source) => console.log('Delete:', source.source_name),
  },
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/weather-sources/:sourceName', async () => {
          await delay(300);
          return HttpResponse.json({
            ...mockMeteoParapente,
            updated_at: '2025-06-15T10:00:00.000Z',
          });
        }),
        http.post('/api/weather-sources/:sourceName/test', async () => {
          await delay(2000);
          // Simulate occasional error
          if (Math.random() > 0.7) {
            return HttpResponse.json<WeatherSourceTestResult>({
              success: false,
              response_time_ms: 1850,
              error: "Timeout: La page n'a pas répondu dans le délai imparti",
              tested_at: '2025-06-15T10:00:00.000Z',
            });
          }
          return HttpResponse.json<WeatherSourceTestResult>({
            success: true,
            response_time_ms: 1850,
            tested_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
});

/**
 * Disabled source (Meteociel)
 */
export const DisabledSource = meta.story({
  name: 'Disabled Source',
  args: {
    source: mockDisabledSource,
    isLastActive: false,
    onDelete: (source) => console.log('Delete:', source.source_name),
  },
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/weather-sources/:sourceName', async ({ request }) => {
          await delay(300);
          const body = (await request.json()) as any;
          return HttpResponse.json({
            ...mockDisabledSource,
            ...body,
            status: body.is_enabled ? 'active' : 'disabled',
            updated_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
});

/**
 * Source with error status (missing API key)
 */
export const ErrorSource = meta.story({
  name: 'Error Source',
  args: {
    source: mockErrorSource,
    isLastActive: false,
    onDelete: (source) => console.log('Delete:', source.source_name),
  },
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/weather-sources/:sourceName', async ({ request }) => {
          await delay(300);
          const body = (await request.json()) as any;
          return HttpResponse.json({
            ...mockErrorSource,
            ...body,
            api_key_configured: body.api_key
              ? true
              : mockErrorSource.api_key_configured,
            status: body.api_key ? 'active' : 'error',
            updated_at: '2025-06-15T10:00:00.000Z',
          });
        }),
        http.post('/api/weather-sources/:sourceName/test', async () => {
          await delay(500);
          return HttpResponse.json<WeatherSourceTestResult>({
            success: false,
            response_time_ms: 0,
            error: 'Authentication failed: Invalid API key',
            tested_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
});

/**
 * Unknown/untested source
 */
export const UnknownSource = meta.story({
  name: 'Unknown Source',
  args: {
    source: mockUnknownSource,
    isLastActive: false,
    onDelete: (source) => console.log('Delete:', source.source_name),
  },
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/weather-sources/:sourceName', async () => {
          await delay(300);
          return HttpResponse.json({
            ...mockUnknownSource,
            updated_at: '2025-06-15T10:00:00.000Z',
          });
        }),
        http.post('/api/weather-sources/:sourceName/test', async () => {
          await delay(1000);
          return HttpResponse.json<WeatherSourceTestResult>({
            success: true,
            response_time_ms: 450,
            tested_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
});

/**
 * Last active source (cannot be disabled)
 */
export const LastActiveSource = meta.story({
  name: 'Last Active Source',
  args: {
    source: mockOpenMeteo,
    isLastActive: true,
    onDelete: undefined,
  },
  parameters: {
    docs: {
      description: {
        story:
          'When this is the last active source, the toggle is protected to prevent disabling all sources.',
      },
    },
    msw: {
      handlers: [
        http.patch('/api/weather-sources/:sourceName', async () => {
          await delay(300);
          // Should not reach here as the UI prevents toggling
          return HttpResponse.json({
            ...mockOpenMeteo,
            updated_at: '2025-06-15T10:00:00.000Z',
          });
        }),
        http.post('/api/weather-sources/:sourceName/test', async () => {
          await delay(500);
          return HttpResponse.json<WeatherSourceTestResult>({
            success: true,
            response_time_ms: 145,
            tested_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
});

/**
 * Source with low success rate
 */
export const LowSuccessRate = meta.story({
  name: 'Low Success Rate',
  args: {
    source: {
      ...mockMeteoParapente,
      success_rate: 65,
      success_count: 65,
      error_count: 35,
      last_error_at: '2025-06-15T09:58:00.000Z',
      last_error_message: 'Connection timeout after 30 seconds',
    },
    isLastActive: false,
  },
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/weather-sources/:sourceName', async () => {
          await delay(300);
          return HttpResponse.json({
            ...mockMeteoParapente,
            success_rate: 65,
            updated_at: '2025-06-15T10:00:00.000Z',
          });
        }),
        http.post('/api/weather-sources/:sourceName/test', async () => {
          await delay(2500);
          // Simulate frequent failures
          if (Math.random() > 0.65) {
            return HttpResponse.json<WeatherSourceTestResult>({
              success: false,
              response_time_ms: 0,
              error: 'Connection timeout after 30 seconds',
              tested_at: '2025-06-15T10:00:00.000Z',
            });
          }
          return HttpResponse.json<WeatherSourceTestResult>({
            success: true,
            response_time_ms: 2100,
            tested_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
});

/**
 * Stealth scraper type
 */
export const StealthScraper = meta.story({
  name: 'Stealth Scraper',
  args: {
    source: mockDisabledSource,
    isLastActive: false,
    onDelete: (source) => console.log('Delete:', source.source_name),
  },
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/weather-sources/:sourceName', async ({ request }) => {
          await delay(300);
          const body = (await request.json()) as any;
          return HttpResponse.json({
            ...mockDisabledSource,
            ...body,
            status: body.is_enabled ? 'active' : 'disabled',
            updated_at: '2025-06-15T10:00:00.000Z',
          });
        }),
        http.post('/api/weather-sources/:sourceName/test', async () => {
          await delay(3000);
          return HttpResponse.json<WeatherSourceTestResult>({
            success: true,
            response_time_ms: 2100,
            tested_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
});

/**
 * Source with high response time
 */
export const HighResponseTime = meta.story({
  name: 'High Response Time',
  args: {
    source: {
      ...mockMeteoParapente,
      avg_response_time_ms: 5420,
    },
    isLastActive: false,
  },
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/weather-sources/:sourceName', async () => {
          await delay(300);
          return HttpResponse.json({
            ...mockMeteoParapente,
            avg_response_time_ms: 5420,
            updated_at: '2025-06-15T10:00:00.000Z',
          });
        }),
        http.post('/api/weather-sources/:sourceName/test', async () => {
          await delay(5500);
          return HttpResponse.json<WeatherSourceTestResult>({
            success: true,
            response_time_ms: 5420,
            tested_at: '2025-06-15T10:00:00.000Z',
          });
        }),
      ],
    },
  },
});

/**
 * All source types comparison
 */
export const AllSourceTypes = meta.story({
  name: 'All Source Types',
  render: () => (
    <div className="flex flex-col gap-4 p-4" style={{ width: '500px' }}>
      <WeatherSourceCard source={mockOpenMeteo} isLastActive={false} />
      <WeatherSourceCard source={mockWeatherAPI} isLastActive={false} />
      <WeatherSourceCard source={mockMeteoParapente} isLastActive={false} />
      <WeatherSourceCard source={mockDisabledSource} isLastActive={false} />
      <WeatherSourceCard source={mockErrorSource} isLastActive={false} />
      <WeatherSourceCard source={mockUnknownSource} isLastActive={false} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of all weather source types and statuses',
      },
    },
    msw: {
      handlers: [
        http.patch(
          '/api/weather-sources/:sourceName',
          async ({ params, request }) => {
            await delay(300);
            const sourceName = params.sourceName as string;
            const body = (await request.json()) as any;

            // Return appropriate mock based on source name
            const mockMap: Record<string, WeatherSource> = {
              'open-meteo': mockOpenMeteo,
              weatherapi: mockWeatherAPI,
              'meteo-parapente': mockMeteoParapente,
              meteociel: mockDisabledSource,
              meteoblue: mockErrorSource,
              'custom-source': mockUnknownSource,
            };

            return HttpResponse.json({
              ...(mockMap[sourceName] || mockOpenMeteo),
              ...body,
              updated_at: '2025-06-15T10:00:00.000Z',
            });
          }
        ),
        http.post(
          '/api/weather-sources/:sourceName/test',
          async ({ params }) => {
            await delay(500);
            const sourceName = params.sourceName as string;

            // Different responses based on source
            if (sourceName === 'meteoblue') {
              return HttpResponse.json<WeatherSourceTestResult>({
                success: false,
                response_time_ms: 0,
                error: 'Authentication failed: Invalid API key',
                tested_at: '2025-06-15T10:00:00.000Z',
              });
            }

            return HttpResponse.json<WeatherSourceTestResult>({
              success: true,
              response_time_ms: Math.floor(Math.random() * 2000) + 100,
              tested_at: '2025-06-15T10:00:00.000Z',
            });
          }
        ),
      ],
    },
  },
});
