import { describe, it, expect } from 'vitest';
import { postRestaurantPayout, assertRestaurantPayoutAllowed } from './postRestaurantPayout';

describe('postRestaurantPayout — รอบจ่ายร้าน (§6.2)', () => {
  it('เดบิต restaurant_payable เครดิต cash ตามตารางใน §6.2', () => {
    const lines = postRestaurantPayout({ amountSatang: 1_824_000 });

    expect(lines).toEqual([
      { account: 'restaurant_payable', debitSatang: 1_824_000, creditSatang: 0 },
      { account: 'cash', debitSatang: 0, creditSatang: 1_824_000 },
    ]);
  });

  /** §5 กติกาข้อ 3 เดบิตเท่ากับเครดิตเป็นคุณสมบัติ ไม่ใช่ตัวอย่างเดียว */
  it('เดบิต = เครดิตเสมอ ทุกยอด', () => {
    for (const amount of [1, 7, 99, 12_345, 1_000_000, 99_999_999]) {
      const lines = postRestaurantPayout({ amountSatang: amount });
      const debit = lines.reduce((s, l) => s + l.debitSatang, 0);
      const credit = lines.reduce((s, l) => s + l.creditSatang, 0);
      expect(debit).toBe(credit);
      expect(debit).toBe(amount);
    }
  });

  it('เศษสตางค์ที่ไม่ใช่จำนวนเต็มถูกปฏิเสธ (§5 กติกาข้อ 1)', () => {
    expect(() => postRestaurantPayout({ amountSatang: 100.5 })).toThrow(/จำนวนเต็ม/);
  });

  it('ยอดศูนย์หรือติดลบจ่ายไม่ได้', () => {
    expect(() => postRestaurantPayout({ amountSatang: 0 })).toThrow();
    expect(() => postRestaurantPayout({ amountSatang: -1 })).toThrow();
  });
});

describe('assertRestaurantPayoutAllowed', () => {
  it('จ่ายได้ไม่เกินยอดที่ค้างอยู่จริง', () => {
    expect(() => assertRestaurantPayoutAllowed({ amountSatang: 500, payableSatang: 500 }))
      .not.toThrow();
    expect(() => assertRestaurantPayoutAllowed({ amountSatang: 501, payableSatang: 500 }))
      .toThrow(/ไม่เกิน/);
  });

  /** ร้านที่ไม่ค้างอะไรแล้วต้องกดจ่ายไม่ได้ ไม่ใช่จ่าย ฿0 เงียบ ๆ */
  it('ร้านที่ไม่มียอดค้าง กดจ่ายไม่ได้', () => {
    expect(() => assertRestaurantPayoutAllowed({ amountSatang: 0, payableSatang: 0 })).toThrow();
  });

  /** ยอดค้างติดลบเกิดได้จริง คืนเงินที่เป็นความผิดของร้าน (§6.4) เดบิต restaurant_payable */
  it('ยอดค้างติดลบ จ่ายออกไม่ได้', () => {
    expect(() => assertRestaurantPayoutAllowed({ amountSatang: 100, payableSatang: -50 }))
      .toThrow(/ไม่เกิน/);
  });
});
