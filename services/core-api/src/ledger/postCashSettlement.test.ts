import { describe, it, expect } from 'vitest';
import { postCashSettlement } from './postCashSettlement';
import { postOrderDelivered, totalsOf } from './postOrder';

describe('ไรเดอร์นำเงินสดส่งคืนบริษัท (§6.2)', () => {
  it('เดบิตเท่ากับเครดิตเสมอ', () => {
    for (const amount of [1, 100, 17000, 150000, 999_999]) {
      const totals = totalsOf(postCashSettlement({ amountSatang: amount }));
      expect(totals.debit).toBe(totals.credit);
      expect(totals.debit).toBe(amount);
    }
  });

  /** เงินเข้าบริษัทจริง และยอดที่ฝากอยู่กับไรเดอร์ลดลงเท่ากัน */
  it('เงินเข้า cash และหักออกจาก rider_cash_held', () => {
    const lines = postCashSettlement({ amountSatang: 17000 });
    expect(lines).toEqual([
      { account: 'cash', debitSatang: 17000, creditSatang: 0 },
      { account: 'rider_cash_held', debitSatang: 0, creditSatang: 17000 },
    ]);
  });

  it('ยอดที่ไม่ใช่จำนวนเต็มสตางค์ถูกปฏิเสธ', () => {
    expect(() => postCashSettlement({ amountSatang: 100.5 })).toThrow();
  });

  it('ยอดศูนย์หรือติดลบถูกปฏิเสธ', () => {
    expect(() => postCashSettlement({ amountSatang: 0 })).toThrow();
    expect(() => postCashSettlement({ amountSatang: -100 })).toThrow();
  });

  /**
   * คุณสมบัติที่สำคัญที่สุด: ส่งงานเงินสดแล้วนำเงินมาคืนเต็มจำนวน
   * ต้องทำให้ยอดคงเหลือใน rider_cash_held กลับเป็นศูนย์พอดี ไม่เหลือเศษ
   * ถ้าไม่เป็นศูนย์ ไรเดอร์จะค่อย ๆ ชนเพดานเงินสดจนรับงานเงินสดไม่ได้อีก
   */
  it('ส่งเงินสดแล้วคืนครบ → ยอดฝากกับไรเดอร์เป็นศูนย์', () => {
    const gross = 15000 + 1500 + 500;
    const delivered = postOrderDelivered({
      method: 'cash',
      foodTotalSatang: 15000,
      deliveryFeeSatang: 1500,
      serviceFeeSatang: 500,
      riderPaySatang: 3000,
      paymentFeeSatang: 0,
    });

    const settled = postCashSettlement({ amountSatang: gross });
    const all = [...delivered, ...settled];

    const held = all
      .filter((l) => l.account === 'rider_cash_held')
      .reduce((sum, l) => sum + l.debitSatang - l.creditSatang, 0);
    expect(held).toBe(0);

    // และทั้งชุดยังสมดุลอยู่
    const totals = totalsOf(all);
    expect(totals.debit).toBe(totals.credit);
  });
});
