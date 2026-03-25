import { definePreview } from '@storybook/react-vite';
import addonA11y from '@storybook/addon-a11y';
import '../src/styles.css';

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
