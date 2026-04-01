import preview from '../../../.storybook/preview';
import Header from './Header';

const meta = preview.meta({
  title: 'Components/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Header component with navigation using Tanstack Router. Demonstrates router integration in Storybook with loaders.',
      },
    },
  },
  tags: ['autodocs'],
});

/**
 * Default header with title
 * Router is initialized at root path '/'
 */
export const Default = meta.story({
  name: 'Default',
  args: {},
});

/**
 * Header with custom title
 */
export const CustomTitle = meta.story({
  name: 'Custom Title',
  args: {
    title: '🪂 Mon Dashboard Personnalisé',
  },
});

/**
 * Header with router initialized on /flights path
 * Demonstrates custom router configuration via parameters
 */
export const OnFlightsPage = meta.story({
  name: 'On Flights Page',
  args: {},
  parameters: {
    router: {
      initialPath: '/flights',
      routes: [{ path: '/flights', element: 'story' }],
      renderRootRoute: (Story: React.ComponentType) => <Story />,
    },
  },
});

/**
 * Header with router initialized on /analytics path
 */
export const OnAnalyticsPage = meta.story({
  name: 'On Analytics Page',
  args: {},
  parameters: {
    router: {
      initialPath: '/analytics',
      routes: [{ path: '/analytics', element: 'story' }],
      renderRootRoute: (Story: React.ComponentType) => <Story />,
    },
  },
});

/**
 * Header in dark mode
 */
export const DarkMode = meta.story({
  name: 'Dark Mode',
  args: {},
  parameters: {
    theme: 'dark',
  },
});

DarkMode.test('should render header in dark mode', async ({ canvas }) => {
  await canvas.findByText('🪂', { exact: false });
});
