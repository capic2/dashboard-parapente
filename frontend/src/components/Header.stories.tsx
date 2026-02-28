import preview from '../../.storybook/preview';
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
  args: {},
});

/**
 * Header with custom title
 */
export const CustomTitle = meta.story({
  args: {
    title: '🪂 Mon Dashboard Personnalisé',
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
      initialEntries: ['/flights'],
      routes: ['/flights'],
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
      initialEntries: ['/analytics'],
      routes: ['/analytics'],
    },
  },
});

export default meta;
