import preview from '../../../.storybook/preview';
import { TanstackRouterDecorator } from '../../../.storybook/decorators';
import Header from './Header';
import { ComponentType } from 'react';

const meta = preview.meta({
  title: 'Components/Header',
  component: Header,
  decorators: [TanstackRouterDecorator],
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
  args: {},
  parameters: {
    router: {
      initialPath: '/',
      routes: [{ path: '/', element: 'story' }],
      renderRootRoute: (Story: ComponentType) => <Story />,
    },
  },
});

/**
 * Header with custom title
 */
export const CustomTitle = meta.story({
  args: {
    title: '🪂 Mon Dashboard Personnalisé',
  },
  parameters: {
    router: {
      initialPath: '/',
      routes: [{ path: '/', element: 'story' }],
      renderRootRoute: (Story: React.ComponentType) => <Story />,
    },
  },
});

/**
 * Header with router initialized on /flights path
 * Demonstrates custom router configuration via parameters
 */
export const OnFlightsPage = meta.story({
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
  args: {},
  parameters: {
    router: {
      initialPath: '/analytics',
      routes: [{ path: '/analytics', element: 'story' }],
      renderRootRoute: (Story: React.ComponentType) => <Story />,
    },
  },
});
