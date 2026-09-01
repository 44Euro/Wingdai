import * as SecureStore from 'expo-secure-store';
import { initI18n, setLanguage, i18n } from '../../src/i18n';
import { choiceKey } from '../../src/lib/prefKeys';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'th' }] }));

describe('ภาษาที่ผู้ใช้เลือกต้องอยู่ข้ามการเปิดแอปใหม่', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync(choiceKey('language'));
  });

  it('ไม่เคยเลือก → ใช้ภาษาของเครื่อง', async () => {
    await initI18n();
    expect(i18n.language).toBe('th');
  });

  it('เคยเลือกอังกฤษไว้ → เปิดใหม่ยังเป็นอังกฤษ ไม่ย้อนกลับไปภาษาเครื่อง', async () => {
    await SecureStore.setItemAsync(choiceKey('language'), 'en');
    await initI18n();
    expect(i18n.language).toBe('en');
  });

  it('กดเลือกภาษาแล้วต้องเขียนลงที่เก็บถาวร ไม่ใช่เปลี่ยนแค่ในหน่วยความจำ', async () => {
    await initI18n();
    await setLanguage('en');
    expect(i18n.language).toBe('en');
    expect(await SecureStore.getItemAsync(choiceKey('language'))).toBe('en');
  });

  it('ค่าที่เก็บไว้เพี้ยน → ตกกลับไปภาษาเครื่อง ไม่ใช่ภาษาที่ไม่มีคำแปล', async () => {
    await SecureStore.setItemAsync(choiceKey('language'), 'fr');
    await initI18n();
    expect(i18n.language).toBe('th');
  });
});
