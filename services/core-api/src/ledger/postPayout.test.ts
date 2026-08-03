import { describe, it, expect } from 'vitest';
import { postPayout, withdrawableSatang, assertWithdrawAllowed } from './postPayout';

const totals = (lines: ReturnType<typeof postPayout>) => ({
  debit: lines.reduce((s, l) => s + l.debitSatang, 0),
  credit: lines.reduce((s, l) => s + l.creditSatang, 0),
});

describe('จ่ายเงินไรเดอร์', () => {
  it('เดบิตหนี้ที่ค้างไรเดอร์ เครดิตเงินสดที่จ่ายออกไป', () => {
    expect(postPayout({ amountSatang: 31_000 })).toEqual([
      { account: 'rider_payable', debitSatang: 31_000, creditSatang: 0 },
      { account: 'cash', debitSatang: 0, creditSatang: 31_000 },
    ]);
  });

  it('เดบิตเท่ากับเครดิตเสมอ ทุกยอดที่เป็นไปได้', () => {
    for (let i = 0; i < 500; i++) {
      const amount = 1 + Math.floor(Math.random() * 5_000_000);
      const t = totals(postPayout({ amountSatang: amount }));
      expect(t.debit).toBe(t.credit);
      expect(t.debit).toBe(amount);
    }
  });

  it('ยอดที่ไม่ใช่จำนวนเต็มสตางค์ถูกปฏิเสธ', () => {
    expect(() => postPayout({ amountSatang: 10.5 })).toThrow();
  });

  it('ยอดศูนย์หรือติดลบถูกปฏิเสธ', () => {
    expect(() => postPayout({ amountSatang: 0 })).toThrow();
    expect(() => postPayout({ amountSatang: -1 })).toThrow();
  });
});

describe('ยอดถอนได้', () => {
  /** product-spec §6.2 เงินสดที่ไรเดอร์ถืออยู่เป็นเงินบริษัทที่ฝากไว้ ไม่ใช่รายได้ */
  it('ถอนได้ = รายได้ค้างจ่าย ลบ เงินสดที่ถืออยู่', () => {
    expect(withdrawableSatang({ payableSatang: 48_000, cashHeldSatang: 17_000 })).toBe(31_000);
  });

  it('ถือเงินสดมากกว่ารายได้ ยอดถอนติดลบได้ ไม่ปัดเป็นศูนย์', () => {
    expect(withdrawableSatang({ payableSatang: 3_000, cashHeldSatang: 17_000 })).toBe(-14_000);
  });

  it('ยอดถอนบวกเงินสดที่ถือ เท่ากับรายได้ค้างจ่ายเสมอ', () => {
    for (let i = 0; i < 500; i++) {
      const payableSatang = Math.floor(Math.random() * 1_000_000);
      const cashHeldSatang = Math.floor(Math.random() * 1_000_000);
      expect(withdrawableSatang({ payableSatang, cashHeldSatang }) + cashHeldSatang).toBe(
        payableSatang,
      );
    }
  });

  it('ถอนเกินยอดสุทธิไม่ได้ แม้รายได้ค้างจ่ายจะพอ', () => {
    expect(() =>
      assertWithdrawAllowed({ amountSatang: 48_000, payableSatang: 48_000, cashHeldSatang: 17_000 }),
    ).toThrow();
    expect(() =>
      assertWithdrawAllowed({ amountSatang: 31_000, payableSatang: 48_000, cashHeldSatang: 17_000 }),
    ).not.toThrow();
  });

  it('ยอดสุทธิติดลบ ถอนเท่าไรก็ไม่ได้', () => {
    expect(() =>
      assertWithdrawAllowed({ amountSatang: 1, payableSatang: 3_000, cashHeldSatang: 17_000 }),
    ).toThrow();
  });

  it('ยอดถอนที่ไม่ใช่จำนวนเต็มหรือไม่เป็นบวก ถูกปฏิเสธก่อนคิดยอดสุทธิ', () => {
    const rich = { payableSatang: 1_000_000, cashHeldSatang: 0 };
    expect(() => assertWithdrawAllowed({ amountSatang: 10.5, ...rich })).toThrow();
    expect(() => assertWithdrawAllowed({ amountSatang: 0, ...rich })).toThrow();
    expect(() => assertWithdrawAllowed({ amountSatang: -5, ...rich })).toThrow();
  });
});
