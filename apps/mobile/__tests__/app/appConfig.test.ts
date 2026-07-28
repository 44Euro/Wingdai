import appJson from '../../app.json';

const { expo } = appJson;

describe('app.json identity', () => {
  it('ใช้ชื่อแบรนด์ Wingdai ตาม claude.md §10 ไม่ใช่ค่า default ของ template', () => {
    expect(expo.name).toBe('Wingdai');
    expect(expo.slug).toBe('wingdai');
  });

  it('bundle id / package ตรงกับที่ลงทะเบียนไว้กับ Google OAuth client', () => {
    expect(expo.ios.bundleIdentifier).toBe('com.wingdai.app');
    expect(expo.android.package).toBe('com.wingdai.app');
  });

  it('มี scheme สำหรับ deep link กลับเข้าแอปหลัง OAuth', () => {
    expect(expo.scheme).toBe('wingdai');
  });

  it('ตามระบบเครื่องได้ทั้งสว่างและมืด ไม่ล็อกโหมดเดียว', () => {
    // ไรเดอร์ทำงานกลางคืน จอสว่างจ้าคือเรื่องความปลอดภัย (claude.md §10)
    // ถ้าเป็น "light" ธีมมืดใน ThemeProvider จะไม่มีวันถูกใช้บนเครื่องจริง
    expect(expo.userInterfaceStyle).toBe('automatic');
  });
});
