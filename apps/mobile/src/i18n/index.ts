import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { choice } from '../lib/choice';
import { setActiveLanguage } from '../lib/activeLanguage';
import th from './locales/th.json';
import en from './locales/en.json';

/** ใครเปลี่ยนภาษาด้วยวิธีไหน ชั้นข้อมูลก็รู้ตาม โดยไม่ต้อง import โมดูลนี้เข้าไป */
i18n.on('languageChanged', setActiveLanguage);

export type AppLanguage = 'th' | 'en';

const SUPPORTED: AppLanguage[] = ['th', 'en'];

export function detectDeviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return code === 'th' ? 'th' : 'en';
}

/** ภาษาที่เลือกไว้ต้องอยู่ข้ามการเปิดแอปใหม่ ไม่งั้นกดรีเฟรชแล้วเด้งกลับไปภาษาเครื่องทุกครั้ง */
async function startingLanguage(): Promise<AppLanguage> {
  const saved = await choice.read('language');
  return SUPPORTED.includes(saved as AppLanguage) ? (saved as AppLanguage) : detectDeviceLanguage();
}

export async function setLanguage(lang: AppLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  await choice.write('language', lang);
}

export async function initI18n(): Promise<void> {
  const lng = await startingLanguage();
  setActiveLanguage(lng);
  if (i18n.isInitialized) {
    await i18n.changeLanguage(lng);
    return;
  }
  await i18n.use(initReactI18next).init({
    resources: { th: { translation: th }, en: { translation: en } },
    lng,
    fallbackLng: 'th',
    interpolation: { escapeValue: false },
  });
}

export { i18n };
