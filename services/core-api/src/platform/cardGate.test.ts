import { describe, it, expect } from 'vitest';
import { assertFeeRateKnown } from './platform.service';

/**
 * §6.5 "don't let card become invisible overhead" — บัตรเสีย 3.2–3.65% พร้อมเพย์เสีย 0.8–1.8%
 * ถ้าเปิดบัตรตอนที่อัตรายังเป็น 0 ทุกออเดอร์บัตรจะลงบัญชีโดยไม่มีบรรทัดค่าธรรมเนียม
 * แล้วบัตรจะดูกำไรเท่าเงินสด ซึ่งคือความผิดพลาดที่ §6.2 ย่อหน้า "Corrected 2026-07-29"
 * แก้ไปแล้วครั้งหนึ่ง ด่านนี้กันไม่ให้มันกลับมาทางประตูสวิตช์
 */
describe('เปิดช่องทางจ่ายเงินที่ยังไม่รู้ค่าธรรมเนียม', () => {
  it('เปิดบัตรไม่ได้ตราบใดที่ยังไม่ตั้งอัตราค่าธรรมเนียม', () => {
    expect(() => assertFeeRateKnown('card_payment')).toThrow(/ค่าธรรมเนียม/);
  });

  it('เงินสดเปิดได้ อัตราเป็น 0 เพราะไม่มีเกตเวย์ให้เสีย ไม่ใช่เพราะยังไม่รู้', () => {
    expect(() => assertFeeRateKnown('cash_payment')).not.toThrow();
  });

  it('flag ที่ไม่เกี่ยวกับช่องทางจ่ายเงินไม่ถูกด่านนี้แตะ', () => {
    expect(() => assertFeeRateKnown('auto_dispatch')).not.toThrow();
    expect(() => assertFeeRateKnown('registration_open')).not.toThrow();
  });

  /** ข้อความต้องบอกทางออก ไม่ใช่แค่บอกว่าไม่ได้ คนอ่านคือซูเปอร์แอดมินที่เพิ่งกดสวิตช์ */
  it('ข้อความบอกว่าต้องไปตั้งอัตราก่อน', () => {
    expect(() => assertFeeRateKnown('card_payment')).toThrow(/PAYMENT_FEE_BP/);
  });
});
