import { openStateLabel } from '../../src/features/customer/openStateLabel';

/** ตัวแปลที่เอาแต่คีย์กับพารามิเตอร์ออกมาตรง ๆ เพื่อยืนยันว่าเลือกคีย์ถูก ไม่ใช่ยืนยันคำแปล */
const t = (key: string, opts?: Record<string, unknown>) =>
  (opts?.time ? `${key}:${opts.time}` : key);

describe('openStateLabel (C28)', () => {
  it('ร้านเปิดอยู่ไม่มีป้าย', () => {
    expect(openStateLabel({ isOpen: true, opensAt: null }, t)).toBeNull();
    // เปิดอยู่แล้วต้องไม่มีป้าย แม้เซิร์ฟเวอร์จะส่ง opensAt ติดมาด้วย
    expect(openStateLabel({ isOpen: true, opensAt: '2026-08-10T09:00:00Z' }, t)).toBeNull();
  });

  it('ปิดและไม่รู้ว่าเปิดอีกทีเมื่อไหร่ = บอกแค่ว่าปิด', () => {
    expect(openStateLabel({ isOpen: false, opensAt: null }, t)).toBe('customer.home.closed');
  });

  it('ปิดแต่รู้รอบเปิด = บอกเวลาไทย', () => {
    // 09:00 เวลาไทย = 02:00Z ต้องได้ 09:00 ไม่ใช่ 02:00
    expect(openStateLabel({ isOpen: false, opensAt: '2026-08-10T02:00:00Z' }, t))
      .toBe('customer.home.opensAt:09:00');
  });

  it('เวลาที่อ่านไม่ออกถอยไปใช้คำว่าปิด ไม่ใช่โชว์ NaN', () => {
    expect(openStateLabel({ isOpen: false, opensAt: 'พรุ่งนี้เช้า' }, t))
      .toBe('customer.home.closed');
  });
});
