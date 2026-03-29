import { definePreview } from '@storybook/react-vite';
import { initialize, mswLoader } from 'msw-storybook-addon';
import addonA11y from '@storybook/addon-a11y';
import { http, HttpResponse } from 'msw';
import i18n from '../src/i18n';
import '../src/App.css';

// Force French locale in Storybook context — overrides LanguageDetector which
// detects English in CI headless browsers
i18n.changeLanguage('fr');
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
];

const initializeMsw = (
  options?: Parameters<typeof initialize>[0],
  handlers?: Parameters<typeof initialize>[1]
) => {
  if (typeof window !== 'undefined' && window.__mswInitialized) {
    return;
  }

  if (typeof window !== 'undefined') {
    window.__mswInitialized = true;
  }

  initialize(options, handlers);
};
// Initialize MSW with default fallback handlers
initializeMsw({ onUnhandledRequest: 'error', quiet: true }, defaultMswHandlers);

const preview = definePreview({
  addons: [addonA11y()],

  parameters: {
    i18n,
    locale: 'fr',
    locales: {
      fr: 'Français',
      en: 'English',
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
    backgrounds: {
      default: 'light',
      options: {
        light: { name: 'Light', value: '#ffffff' },
        dark: { name: 'Dark', value: '#1a1a1a' },
      },
    },
    layout: 'centered',
  },

  // Global decorators
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <div style={{ padding: '1rem' }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],

  // MSW loader
  loaders: [mswLoader],

  // Tags
  tags: ['autodocs'],
});

export default preview;
