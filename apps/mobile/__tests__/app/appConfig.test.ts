import config from '../../app.config';

/** ตรวจ app.config.ts ไม่ใช่ app.json */
describe('app.config.ts identity', () => {
  it('ใช้ชื่อแบรนด์ Wingdai ตาม product-spec §10', () => {
    expect(config.name).toBe('Wingdai');
    expect(config.slug).toBe('wingdai');
  });

  it('bundle id / package ตรงกับที่ลงทะเบียนไว้กับ Google OAuth client', () => {
    expect(config.ios?.bundleIdentifier).toBe('com.wingdai.app');
    expect(config.android?.package).toBe('com.wingdai.app');
  });

  it('มี scheme สำหรับ deep link กลับเข้าแอปหลัง OAuth', () => {
    expect(config.scheme).toBe('wingdai');
  });

  it('ตามระบบเครื่องได้ทั้งสว่างและมืด ไม่ล็อกโหมดเดียว', () => {
    // ไรเดอร์ทำงานกลางคืน จอสว่างจ้าคือเรื่องความปลอดภัย (product-spec §10)
    expect(config.userInterfaceStyle).toBe('automatic');
  });

  it('เก็บ expo-localization ไว้ — src/i18n ต้องใช้', () => {
    expect(config.plugins).toContain('expo-localization');
  });
});
