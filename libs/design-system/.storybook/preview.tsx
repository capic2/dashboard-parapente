import { definePreview } from '@storybook/react-vite';
import '../src/styles.css';

export default definePreview({
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
});
