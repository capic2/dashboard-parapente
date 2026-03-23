import { definePreview } from '@storybook/react-vite';
import { initialize, mswLoader } from 'msw-storybook-addon';
import addonA11y from '@storybook/addon-a11y';
import '../src/App.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

declare global {
  interface Window {
    __mswInitialized?: boolean
  }
}

const initializeMsw = (options?: Parameters<typeof initialize>[0]) => {
  if (typeof window !== 'undefined' && window.__mswInitialized) {
    return
  }

  if (typeof window !== 'undefined') {
    window.__mswInitialized = true
  }

  initialize(options)
}
// Initialize MSW
initializeMsw();


const preview = definePreview({
  addons: [addonA11y()],

  parameters: {
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
