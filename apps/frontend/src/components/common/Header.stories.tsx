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
