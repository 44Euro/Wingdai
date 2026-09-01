import { describe, it, expect } from 'vitest';
import { assertCanReview, summarise } from './eligibility';

const delivered = { customerId: 'u1', status: 'delivered' as const };

describe('ใครรีวิวได้ (design C11)', () => {
  it('ลูกค้าเจ้าของออเดอร์ที่ได้รับของแล้ว รีวิวได้', () => {
    expect(() =>
      assertCanReview({ viewerId: 'u1', order: delivered, alreadyReviewed: false }),
    ).not.toThrow();
  });

  /** รีวิวที่เขียนได้โดยไม่ต้องเคยสั่ง = รีวิวที่ซื้อได้ ร้านคู่แข่งถล่มดาวหนึ่งได้ฟรี */
  it('คนอื่นรีวิวออเดอร์ที่ไม่ใช่ของตัวเองไม่ได้', () => {
    expect(() =>
      assertCanReview({ viewerId: 'u2', order: delivered, alreadyReviewed: false }),
    ).toThrow(/ของตัวเอง/);
  });

  it('ยังไม่ได้รับอาหาร รีวิวไม่ได้', () => {
    for (const status of ['created', 'accepted', 'preparing', 'picked_up'] as const) {
      expect(() =>
        assertCanReview({
          viewerId: 'u1', order: { customerId: 'u1', status }, alreadyReviewed: false,
        }),
      ).toThrow(/หลังจากได้รับอาหาร/);
    }
  });

  it('ใบที่ยกเลิกไปแล้วรีวิวไม่ได้ — ไม่เคยมีอาหารให้ตัดสิน', () => {
    expect(() =>
      assertCanReview({
        viewerId: 'u1', order: { customerId: 'u1', status: 'cancelled' }, alreadyReviewed: false,
      }),
    ).toThrow(/หลังจากได้รับอาหาร/);
  });

  /** หนึ่งใบหนึ่งรีวิว ไม่งั้นคนเดียวปั้มดาวได้ไม่จำกัดจากออร์เดอร์เดียว */
  it('รีวิวซ้ำใบเดิมไม่ได้', () => {
    expect(() =>
      assertCanReview({ viewerId: 'u1', order: delivered, alreadyReviewed: true }),
    ).toThrow(/รีวิวไปแล้ว/);
  });
});

describe('สรุปคะแนน (design C36 · M9)', () => {
  it('ยังไม่มีรีวิว = null ไม่ใช่ 0 ดาว', () => {
    const s = summarise([]);
    expect(s.average).toBeNull();
    expect(s.count).toBe(0);
  });

  it('คืนครบทั้งห้าระดับเสมอ แม้ระดับนั้นไม่มีใครให้', () => {
    const s = summarise([5, 5]);
    expect(s.breakdown.map((b) => b.stars)).toEqual([5, 4, 3, 2, 1]);
    expect(s.breakdown.find((b) => b.stars === 3)!.count).toBe(0);
  });

  it('นับจำนวนแต่ละระดับถูก และผลรวมเท่ากับจำนวนรีวิว', () => {
    const s = summarise([5, 4, 4, 1]);
    expect(s.count).toBe(4);
    expect(s.breakdown.find((b) => b.stars === 4)!.count).toBe(2);
    expect(s.breakdown.reduce((sum, b) => sum + b.count, 0)).toBe(s.count);
  });

  it('เฉลี่ยปัดทศนิยมเดียว ให้สองจอปัดตรงกัน', () => {
    expect(summarise([5, 5, 5, 4]).average).toBe(4.8);
    expect(summarise([4, 5]).average).toBe(4.5);
    expect(summarise([1, 2]).average).toBe(1.5);
  });

  it('ทุกใบเท่ากันได้ค่านั้นพอดี ไม่เพี้ยนจากทศนิยม', () => {
    expect(summarise([3, 3, 3]).average).toBe(3);
  });
});
