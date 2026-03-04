import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './locales/en';
import vi from './locales/vi';

export type SupportedLanguage = 'en' | 'vi';

export const resources = {
  en: { translation: en },
  vi: { translation: vi },
} as const;

// Detect device language
const deviceLocale = getLocales()[0]?.languageCode ?? 'en';
const defaultLanguage: SupportedLanguage =
  deviceLocale === 'vi' ? 'vi' : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
