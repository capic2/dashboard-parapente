import { definePreview } from '@storybook/react-vite';
import addonA11y from '@storybook/addon-a11y';
import { sb } from 'storybook/test';
import '../src/styles.css';

sb.mock(import('../src/utils/dateUtils.ts'), { spy: true });

export default definePreview({
  addons: [addonA11y()],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
});
