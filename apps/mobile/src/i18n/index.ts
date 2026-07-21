import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import th from './locales/th.json';
import en from './locales/en.json';

export type AppLanguage = 'th' | 'en';

export function detectDeviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return code === 'th' ? 'th' : 'en';
}

export async function initI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources: { th: { translation: th }, en: { translation: en } },
    lng: detectDeviceLanguage(),
    fallbackLng: 'th',
    interpolation: { escapeValue: false },
  });
}

export { i18n };
