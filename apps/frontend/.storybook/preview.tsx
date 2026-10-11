import { definePreview } from '@storybook/react-vite';
import addonMsw from 'msw-storybook-addon';
import addonA11y from '@storybook/addon-a11y';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import '../src/App.css';
import { Suspense, useEffect, useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TanstackRouterDecorator } from './decorators';

// Default MSW handlers — fallback responses for common API endpoints.
// Individual stories override these with their own parameters.msw.handlers.
// These survive resetHandlers() between stories because they are passed
// as initialHandlers to setupWorker().
const defaultMswHandlers = [
  http.get('*/api/flights', () => HttpResponse.json({ flights: [] })),
  http.get('*/api/flights/stats', () => HttpResponse.json({})),
  http.get('*/api/flights/records', () => HttpResponse.json({ records: {} })),
  http.get('*/api/flights/:id', () => HttpResponse.json({})),
  http.get('*/api/flights/:id/youtube-upload', () => HttpResponse.json(null)),
  http.get('*/api/flights/:id/youtube-videos', () => HttpResponse.json([])),
  http.get('*/api/flights/:id/highlight-videos', () => HttpResponse.json([])),
  http.get('*/api/flights/:id/overlay-layer', () =>
    HttpResponse.json({ status: 'missing', job: null })
  ),
  http.get('*/api/flights/:id/gopro-overlay/preview', () =>
    HttpResponse.json({ status: 'missing', job: null })
  ),
  http.get('*/api/youtube/status', () =>
    HttpResponse.json({ configured: true, connected: false })
  ),
  http.get('*/api/video-export-jobs', () => HttpResponse.json({ jobs: [] })),
  http.get('*/api/video-export-jobs/stream', () =>
    new Response(null, { status: 204 })
  ),
  http.get('*/api/spots', () => HttpResponse.json({ sites: [] })),
  http.get('*/api/spots/:id', () => HttpResponse.json({})),
  http.get('*/api/weather/:spotId/daily-summary', () =>
    HttpResponse.json({ days: [] })
  ),
  http.get('*/api/weather/:spotId', () =>
    HttpResponse.json({
      site_id: '',
      site_name: '',
      day_index: 0,
      days: 1,
      consensus: [],
      para_index: 0,
      verdict: '',
      emoji: '',
      explanation: '',
      slots_summary: '',
    })
  ),
  http.get('*/api/flight-decision/:siteId', ({ params }) =>
    HttpResponse.json({
      site: {
        id: String(params.siteId),
        name: '',
        usage_type: null,
        orientation: null,
      },
      objective: 'tranquille',
      timezone: 'Europe/Paris',
      day_index: 0,
      summary: {
        level: 'unavailable',
        translation_key: '',
        score_objectif: 0,
        title_key: '',
        message_key: '',
        message_params: {},
        has_recommended_window: false,
      },
      best_window: null,
      least_unfavorable_window: null,
      hourly: [],
      risks: [],
      confidence: {
        level: 'low',
        score: 0,
        translation_key: '',
        source_count: 0,
        expected_source_count: 0,
        freshness: { status: 'unknown' },
        diagnostics: [],
      },
      landing_safety: {
        status: 'unavailable',
        level: 'unavailable',
        translation_key: '',
        summary_key: '',
        summary_params: {},
        landings: [],
      },
      live_wind: {
        status: 'unavailable',
        influences_confidence: false,
        stations: [],
        diagnostics: [],
      },
      alternatives: [],
    })
  ),
  http.get('*/api/sites/:siteId/airspace/azba', ({ params }) =>
    HttpResponse.json({
      site_id: String(params.siteId),
      site_name: '',
      status: 'unknown',
      source: 'storybook',
      source_url: '',
      retrieved_at: '2026-10-10T00:00:00Z',
      valid_from: '2026-10-10T00:00:00Z',
      valid_to: '2026-10-11T00:00:00Z',
      radius_km: 30,
      constraints: [],
    })
  ),
  http.get('*/api/sites/:siteId/live-wind', ({ params }) =>
    HttpResponse.json({
      site_id: String(params.siteId),
      site_name: '',
      source: 'storybook',
      radius_km: 30,
      stations: [],
    })
  ),
  http.get('*/api/sites/:siteId/landings/weather', () =>
    HttpResponse.json({ landings: [] })
  ),
  http.get('*/api/sites/:siteId/landings', () => HttpResponse.json([])),
  http.get('*/api/admin/intervals/status', () =>
    HttpResponse.json({ configured: false, activity_types: [] })
  ),
  http.get('*/api/video-export-gpu-status', () =>
    HttpResponse.json({ available: false, devices: [] })
  ),
  http.get('*/api/flights/:id/overlay-layer', () =>
    HttpResponse.json({ status: 'missing', job: null })
  ),
  http.get('*/api/flights/:id/highlight-videos', () => HttpResponse.json([])),
  http.get('*/api/flights/:id/youtube-videos', () => HttpResponse.json([])),
  http.get('*/api/emagram/latest', () => HttpResponse.json(null)),
  http.get('*/api/emagram/hours', () =>
    HttpResponse.json({ site_id: '', forecast_date: '', hours: [] })
  ),
  http.get('*/api/emagram/history', () => HttpResponse.json([])),
  http.post('*/api/emagram/analyze', () => HttpResponse.json({})),
  http.get('*/api/settings', () =>
    HttpResponse.json({
      cache_ttl_default: '3600',
      cache_ttl_summary: '3600',
      scheduler_interval_minutes: '30',
      redis_connect_timeout: '5',
      redis_socket_timeout: '5',
    })
  ),
  http.put('*/api/settings', () =>
    HttpResponse.json({ success: true, updated: {} })
  ),
  http.get(/approximateTerrainHeights\.json(?:\?.*)?$/, () =>
    HttpResponse.json({})
  ),
];

const setupMsw = async () => {
  const { setupWorker } = await import('msw/browser');
  const worker = setupWorker(...defaultMswHandlers);
  await worker.start({ onUnhandledFrame: 'error', quiet: true });
  return worker;
};

// i18n decorator — syncs the toolbar locale global with the i18n instance
function I18nDecorator({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const onChanged = () => setKey(Date.now());
    i18n.on('languageChanged', onChanged);
    return () => {
      i18n.off('languageChanged', onChanged);
    };
  }, []);

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  return (
    <I18nextProvider i18n={i18n} key={key}>
      {children}
    </I18nextProvider>
  );
}

// Theme decorator — applies/removes .dark class based on the current mode or toolbar global
function ThemeDecorator({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: string;
}) {
  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.style.backgroundColor = isDark ? '#111827' : '#ffffff';
    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
    };
  }, [theme]);

  return <>{children}</>;
}

const preview = definePreview({
  addons: [addonA11y(), addonMsw(setupMsw)],

  parameters: {
    router: {
      initialPath: '/',
      routes: [{ path: '/', element: 'story' as const }],
      renderRootRoute: (Story: React.ComponentType) => (
        <QueryClientProvider client={new QueryClient()}>
          <Suspense fallback={<div>Loading…</div>}>
            <Story />
          </Suspense>
        </QueryClientProvider>
      ),
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
    chromatic: {
      modes: {
        'light-desktop': {
          theme: 'light',
          viewport: { width: 1280, height: 900 },
        },
        'dark-desktop': {
          theme: 'dark',
          viewport: { width: 1280, height: 900 },
        },
        'light-mobile': {
          theme: 'light',
          viewport: { width: 375, height: 812 },
        },
        'dark-mobile': {
          theme: 'dark',
          viewport: { width: 375, height: 812 },
        },
      },
      disableSnapshot: true,
    },
    layout: 'centered',
  },

  initialGlobals: {
    theme: 'light',
    locale: 'fr',
    locales: {
      fr: 'Français',
      en: 'English',
    },
  },

  // Global decorators
  decorators: [
    (Story, context) => {
      const theme =
        context.globals?.theme ?? context.parameters?.theme ?? 'light';
      const locale = context.globals?.locale ?? 'fr';
      return (
        <I18nDecorator locale={locale}>
          <ThemeDecorator theme={theme}>
            <div style={{ padding: '1rem' }}>
              <Story />
            </div>
          </ThemeDecorator>
        </I18nDecorator>
      );
    },
    TanstackRouterDecorator,
  ],

  // Tags
  tags: ['autodocs'],
});

export default preview;
