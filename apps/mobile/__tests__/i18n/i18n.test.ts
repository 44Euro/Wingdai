import th from '../../src/i18n/locales/th.json';
import en from '../../src/i18n/locales/en.json';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null
      ? flatten(v as Record<string, unknown>, key)
      : [key];
  });
}

describe('ไฟล์แปลภาษา', () => {
  const thKeys = flatten(th).sort();
  const enKeys = flatten(en).sort();

  it('ไทยและอังกฤษมี key ครบเท่ากัน', () => {
    expect(thKeys).toEqual(enKeys);
  });

  it('ไม่มีค่าว่างในไฟล์ไทย', () => {
    flatten(th).forEach((key) => {
      const value = key.split('.').reduce<any>((o, k) => o[k], th);
      expect(String(value).trim().length).toBeGreaterThan(0);
    });
  });

  it('ไม่มีค่าว่างในไฟล์อังกฤษ', () => {
    flatten(en).forEach((key) => {
      const value = key.split('.').reduce<any>((o, k) => o[k], en);
      expect(String(value).trim().length).toBeGreaterThan(0);
    });
  });

  it('ไฟล์อังกฤษต้องไม่มีอักษรไทยหลงเหลือ', () => {
    flatten(en).forEach((key) => {
      const value = String(key.split('.').reduce<any>((o, k) => o[k], en));
      expect(value).not.toMatch(/[฀-๿]/);
    });
  });
});
