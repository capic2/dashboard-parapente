import { definePreview } from '@storybook/react-vite';
import addonA11y from '@storybook/addon-a11y';
import { sb } from 'storybook/test';
import i18n from './i18n';
import '../src/styles.css';

sb.mock(import('../src/utils/dateUtils.ts'), { spy: true });

const OriginalDateNow = Date.now;

export default definePreview({
  addons: [addonA11y()],
  decorators: [
    (Story, context) => {
      const frozenDate = context.parameters.frozenDate;
      if (frozenDate instanceof Date) {
        Date.now = () => frozenDate.getTime();
      } else {
        Date.now = OriginalDateNow;
      }
      return <Story />;
    },
  ],
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
  },
});
