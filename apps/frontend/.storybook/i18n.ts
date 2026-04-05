import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from '../src/locales/fr/translation.json';
import en from '../src/locales/en/translation.json';

// Storybook-specific i18n instance without LanguageDetector
// so that the storybook-react-i18next addon can control the language
// via the toolbar without interference.
i18n.use(initReactI18next).init({
  fallbackLng: 'fr',
  supportedLngs: ['fr', 'en'],
  interpolation: { escapeValue: false },
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
});

export default i18n;
