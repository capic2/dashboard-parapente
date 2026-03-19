import type { Meta, StoryObj } from '@storybook/react';
import Header from './Header';

const meta: Meta<typeof Header> = {
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
};

export default meta;
type Story = StoryObj<typeof Header>;

/**
 * Default header with title
 * Router is initialized at root path '/'
 */
export const Default: Story = {
  args: {},
};

/**
 * Header with custom title
 */
export const CustomTitle: Story = {
  args: {
    title: '🪂 Mon Dashboard Personnalisé',
  },
};

/**
 * Header with router initialized on /flights path
 * Demonstrates custom router configuration via parameters
 */
export const OnFlightsPage: Story = {
  args: {},
  parameters: {
    router: {
      initialEntries: ['/flights'],
      routes: ['/flights'],
    },
  },
};

/**
 * Header with router initialized on /analytics path
 */
export const OnAnalyticsPage: Story = {
  args: {},
  parameters: {
    router: {
      initialEntries: ['/analytics'],
      routes: ['/analytics'],
    },
  },
};
