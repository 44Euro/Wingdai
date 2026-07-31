import { describe, it, expect } from 'vitest';
import { postRefund } from './postRefund';
import { totalsOf } from './postOrder';

describe('รายการบัญชีของการคืนเงิน (product-spec §6.4)', () => {
  /** สมบัติที่ห้ามพลาด ทดสอบข้ามหลายยอดและทุกฝ่ายที่รับผิดชอบ */
  it('เดบิตเท่ากับเครดิตเสมอ ทุกยอด ทุกฝ่ายที่รับผิดชอบ', () => {
    for (const fault of ['restaurant', 'rider', 'platform'] as const) {
      for (const amount of [1, 99, 5_000, 12_345, 1_000_000]) {
        const t = totalsOf(postRefund({ amountSatang: amount, fault }));
        expect(t.debit, `${fault} ${amount}`).toBe(t.credit);
        expect(t.debit).toBe(amount);
      }
    }
  });

  it('เงินออกจากบริษัทไปหาลูกค้าเสมอ', () => {
    for (const fault of ['restaurant', 'rider', 'platform'] as const) {
      const cash = postRefund({ amountSatang: 5_000, fault }).find((l) => l.account === 'cash');
      expect(cash?.creditSatang, fault).toBe(5_000);
    }
  });

  /** §6.4 fault ไม่ได้เก็บไว้ทำรายงานอย่างเดียว มันเปลี่ยนว่าใครเสียเงินจริง */
  it('ความรับผิดตัดสินว่าใครจ่าย', () => {
    expect(postRefund({ amountSatang: 5_000, fault: 'restaurant' })[0]!.account)
      .toBe('restaurant_payable');
    expect(postRefund({ amountSatang: 5_000, fault: 'rider' })[0]!.account).toBe('rider_payable');
    expect(postRefund({ amountSatang: 5_000, fault: 'platform' })[0]!.account)
      .toBe('refund_expense');
  });

  it('ไม่มีแถวที่เป็นศูนย์ทั้งสองข้าง (ฐานมี CHECK กันไว้)', () => {
    for (const fault of ['restaurant', 'rider', 'platform'] as const) {
      for (const line of postRefund({ amountSatang: 7_000, fault })) {
        expect((line.debitSatang > 0) !== (line.creditSatang > 0)).toBe(true);
      }
    }
  });

  /** §5 กติกาข้อ 1 เงินเป็นสตางค์จำนวนเต็ม ห้ามมีทศนิยมหลุดเข้ามาถึง ledger */
  it('ยอดที่มีเศษทศนิยมถูกปฏิเสธ ไม่ใช่ปัดให้เอง', () => {
    expect(() => postRefund({ amountSatang: 50.5, fault: 'platform' })).toThrow();
  });

  it('ยอดศูนย์หรือติดลบถูกปฏิเสธ', () => {
    expect(() => postRefund({ amountSatang: 0, fault: 'platform' })).toThrow();
    expect(() => postRefund({ amountSatang: -100, fault: 'platform' })).toThrow();
  });
});
