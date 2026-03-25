import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from '../src/locales/fr/translation.json'
import en from '../src/locales/en/translation.json'

i18n.use(initReactI18next).init({
  fallbackLng: 'fr',
  supportedLngs: ['fr', 'en'],
  interpolation: { escapeValue: false },
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
})

export default i18n
