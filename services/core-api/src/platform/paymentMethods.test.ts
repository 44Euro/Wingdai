import { describe, it, expect } from 'vitest';
import { splitPaymentMethods } from './paymentMethods';
import { DEFAULT_FLAGS } from './platform.service';

const flags = (over: Partial<typeof DEFAULT_FLAGS> = {}) => ({ ...DEFAULT_FLAGS, ...over });

describe('splitPaymentMethods', () => {
  /** §6.5 บัตรอยู่ในรายการแต่เลือกไม่ได้ จนกว่า §11.3 จะได้คำตอบ ซ่อนไปเลยไม่ใช่สิ่งที่สเปกสั่ง */
  it('ช่องทางที่ flag ปิดยังอยู่ในรายการ แต่ไปกองฝั่งใช้ไม่ได้', () => {
    const { available, unavailable } = splitPaymentMethods(flags({ card_payment: false }));

    expect(available).not.toContain('card');
    expect(unavailable).toEqual([{ method: 'card', gate: 'card_payment' }]);
  });

  /** เหตุผลผูกกับ gate ปิดเงินสดจึงได้ป้ายที่ถูกต้องโดยไม่ต้องแก้อะไรเพิ่ม */
  it('ปิดเงินสดก็ได้เหตุผลของตัวเองมาโดยไม่ต้องเขียนเพิ่ม', () => {
    const { unavailable } = splitPaymentMethods(
      flags({ cash_payment: false, card_payment: true }),
    );

    expect(unavailable).toEqual([{ method: 'cash', gate: 'cash_payment' }]);
  });

  it('ปิดทั้งสองตัวก็ยังเรียงตามลำดับที่ควรแสดง', () => {
    const { available, unavailable } = splitPaymentMethods(
      flags({ cash_payment: false, card_payment: false }),
    );

    expect(available).toEqual(['promptpay']);
    expect(unavailable.map((u) => u.method)).toEqual(['cash', 'card']);
  });

  /**
   * §3 ข้อ 5 พร้อมเพย์ต้องเป็นทางที่ปิดไม่ได้ ไม่งั้นมีสถานะที่ไม่มีใครจ่ายเงินได้เลย
   * เทสต์นี้จะล้มทันทีถ้ามีคนเผลอเพิ่ม flag ให้พร้อมเพย์
   */
  it('พร้อมเพย์ไม่มีทางหลุดไปฝั่งใช้ไม่ได้', () => {
    const allOff = Object.fromEntries(
      Object.keys(DEFAULT_FLAGS).map((k) => [k, false]),
    ) as typeof DEFAULT_FLAGS;

    const { available, unavailable } = splitPaymentMethods(allOff);

    expect(available).toContain('promptpay');
    expect(unavailable.map((u) => u.method)).not.toContain('promptpay');
  });

  it('ทุกช่องทางที่ระบบรู้จักต้องโผล่ข้างใดข้างหนึ่งเสมอ ไม่มีตัวหาย', () => {
    const { available, unavailable } = splitPaymentMethods(flags({ card_payment: false }));

    expect([...available, ...unavailable.map((u) => u.method)].sort()).toEqual(
      ['card', 'cash', 'promptpay'],
    );
  });
});

describe('ค่าตั้งต้นของ feature flag', () => {
  /** §6.5 "Card — listed in the picker but not selectable yet" §11.3 ยังไม่ได้คำตอบ */
  it('บัตรปิดอยู่ตราบใดที่ยังไม่มีเกตเวย์', () => {
    expect(DEFAULT_FLAGS.card_payment).toBe(false);
  });
});
