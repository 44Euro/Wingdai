import { initI18n, i18n } from '../../src/i18n';

describe('การแปล', () => {
  beforeAll(async () => {
    await initI18n();
  });

  it('แปลภาษาไทยได้', async () => {
    await i18n.changeLanguage('th');
    expect(i18n.t('auth.login.title')).toBe('เข้าสู่ระบบ');
  });

  it('แปลภาษาอังกฤษได้', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('auth.login.title')).toBe('Log in');
  });

  it('ชื่อแบรนด์ไม่ถูกแปล', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('common.appName')).toBe('Wingdai');
    await i18n.changeLanguage('th');
    expect(i18n.t('common.appName')).toBe('Wingdai');
  });
});
