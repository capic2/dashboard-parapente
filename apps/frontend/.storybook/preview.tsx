import { definePreview } from '@storybook/react-vite';
import { initialize, mswLoader } from 'msw-storybook-addon';
import addonA11y from '@storybook/addon-a11y';
import addonI18n from 'storybook-react-i18next';
import { http, HttpResponse } from 'msw';
import i18n from '../src/i18n';
import '../src/App.css';
import { Suspense, useEffect } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TanstackRouterDecorator } from './decorators';

declare global {
  interface Window {
    __mswInitialized?: boolean;
  }
}

// Default MSW handlers — fallback responses for common API endpoints.
// Individual stories override these with their own parameters.msw.handlers.
// These survive resetHandlers() between stories because they are passed
// as initialHandlers to setupWorker().
const defaultMswHandlers = [
  http.get('*/api/flights', () => HttpResponse.json({ flights: [] })),
  http.get('*/api/flights/stats', () => HttpResponse.json({})),
  http.get('*/api/flights/records', () => HttpResponse.json({ records: {} })),
  http.get('*/api/flights/:id', () => HttpResponse.json({})),
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
  http.get('*/api/sites/:siteId/landings', () => HttpResponse.json([])),
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
];

const initializeMsw = (
  options?: Parameters<typeof initialize>[0],
  handlers?: Parameters<typeof initialize>[1]
) => {
  if (typeof window !== 'undefined' && window.__mswInitialized) {
    return;
  }

  initialize(options, handlers);

  if (typeof window !== 'undefined') {
    window.__mswInitialized = true;
  }
};
// Initialize MSW with default fallback handlers
initializeMsw({ onUnhandledRequest: 'error', quiet: true }, defaultMswHandlers);

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
  addons: [addonA11y(), addonI18n],

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
    i18n,
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
      return (
        <ThemeDecorator theme={theme}>
          <div style={{ padding: '1rem' }}>
            <Story />
          </div>
        </ThemeDecorator>
      );
    },
    TanstackRouterDecorator,
  ],

  // MSW loader
  loaders: [mswLoader],

  // Tags
  tags: ['autodocs'],
});

export default preview;
