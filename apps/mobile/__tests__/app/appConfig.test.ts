import config from '../../app.config';

/**
 * ตรวจ app.config.ts ไม่ใช่ app.json
 * Expo อ่าน app.config.ts แล้ว "แทนที่" app.json ทั้งไฟล์เมื่อ export เป็น object ตรง ๆ
 * (ไม่ merge กัน) — app.json จึงถูกลบทิ้งไปแล้วเพื่อไม่ให้มีสองแหล่งความจริงที่ขัดกัน
 */
describe('app.config.ts identity', () => {
  it('ใช้ชื่อแบรนด์ Wingdai ตาม claude.md §10', () => {
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
    // ไรเดอร์ทำงานกลางคืน จอสว่างจ้าคือเรื่องความปลอดภัย (claude.md §10)
    expect(config.userInterfaceStyle).toBe('automatic');
  });

  it('เก็บ expo-localization ไว้ — src/i18n ต้องใช้', () => {
    expect(config.plugins).toContain('expo-localization');
  });
});
