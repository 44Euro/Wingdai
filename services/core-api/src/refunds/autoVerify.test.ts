import { describe, it, expect } from 'vitest';
import {
  recommendRefund, DISPUTE_WINDOW_HOURS, FAST_REFUND_CEILING_SATANG,
  type RefundFacts,
} from './autoVerify';

const NOW = new Date('2026-08-01T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const facts = (over: Partial<RefundFacts> = {}): RefundFacts => ({
  reason: 'wrong_item',
  orderTotalSatang: 15_000,
  orderStatus: 'delivered',
  deliveredAt: hoursAgo(1),
  reportedAt: NOW,
  hasCustomerPhoto: true,
  hasDeliveryPhoto: false,
  customerOrderCount: 20,
  customerDisputeCount: 1,
  ...over,
});

describe('ตรวจอัตโนมัติแล้วเสนอคำตัดสิน (product-spec §6.4)', () => {
  it('ของผิด แจ้งทันที ยอดไม่สูง ประวัติปกติ → เสนอคืนเต็ม', () => {
    const r = recommendRefund(facts());
    expect(r.verdict).toBe('suggest_full');
    expect(r.suggestedAmountSatang).toBe(15_000);
    expect(r.fault).toBe('restaurant');
  });

  /** §6.4 ห้ามโชว์แค่ปุ่มคืนเงินเปล่า ๆ ต้องมีเหตุผลให้แอดมินอ่านก่อนกด */
  it('ทุกคำตอบมีเหตุผลติดมาเสมอ ไม่ใช่แค่ตัวเลข', () => {
    expect(recommendRefund(facts()).reasoning.length).toBeGreaterThan(0);
    expect(recommendRefund(facts({ reason: 'other' })).reasoning.length).toBeGreaterThan(0);
  });

  describe('การกำหนดความรับผิด', () => {
    it('ของผิด/ของขาด/อาหารมีปัญหา = ร้านรับ', () => {
      for (const reason of ['wrong_item', 'missing_item', 'food_quality'] as const) {
        expect(recommendRefund(facts({ reason })).fault, reason).toBe('restaurant');
      }
    });

    it('หกเสียหายระหว่างส่ง = ไรเดอร์รับ', () => {
      expect(recommendRefund(facts({ reason: 'damaged' })).fault).toBe('rider');
    });

    it('ส่งช้า = แพลตฟอร์มรับเอง ไม่โยนให้ร้านหรือไรเดอร์', () => {
      expect(recommendRefund(facts({ reason: 'late' })).fault).toBe('platform');
    });

    /** เดาว่าใครผิดจากคำว่า "อื่น ๆ" = โยนค่าใช้จ่ายให้คนที่อาจไม่ได้ทำอะไรผิด */
    it('เหตุผล "อื่น ๆ" ไม่เดาว่าใครผิด และไม่เสนอยอด', () => {
      const r = recommendRefund(facts({ reason: 'other' }));
      expect(r.fault).toBeNull();
      expect(r.verdict).toBe('needs_review');
      expect(r.suggestedAmountSatang).toBeNull();
    });
  });

  describe('กรอบเวลา', () => {
    it(`แจ้งเกิน ${DISPUTE_WINDOW_HOURS} ชม. หลังส่งถึง = ไม่เข้าเงื่อนไข`, () => {
      const r = recommendRefund(facts({ deliveredAt: hoursAgo(DISPUTE_WINDOW_HOURS + 1) }));
      expect(r.verdict).toBe('not_eligible');
      expect(r.suggestedAmountSatang).toBeNull();
    });

    it('แจ้งพอดีขอบเวลายังทัน', () => {
      expect(recommendRefund(facts({ deliveredAt: hoursAgo(DISPUTE_WINDOW_HOURS) })).verdict)
        .toBe('suggest_full');
    });

    it('ออเดอร์ที่ยังไม่ส่งถึงแจ้งเรื่องคุณภาพไม่ได้', () => {
      expect(recommendRefund(facts({ orderStatus: 'preparing', deliveredAt: null })).verdict)
        .toBe('not_eligible');
    });

    /** "ไม่ได้รับของ" คือการโต้แย้งว่าสถานะที่ระบบบันทึกไว้นั่นแหละผิด จึงต้องแจ้งได้ */
    it('แจ้งว่าไม่ได้รับของ ทำได้แม้ระบบยังไม่ขึ้นว่าส่งถึง', () => {
      const r = recommendRefund(facts({
        reason: 'not_delivered', orderStatus: 'picked_up', deliveredAt: null,
      }));
      // รับเรื่องได้ แต่ต้องให้คนตัดสิน ระบบตรวจเองไม่ได้ว่าของถึงมือหรือไม่
      expect(r.verdict).toBe('needs_review');
    });
  });

  describe('เกณฑ์ยอดเงิน', () => {
    it('ยอดสูงเกินเกณฑ์ไม่เสนอคืนเต็มอัตโนมัติ แต่ก็ไม่ปฏิเสธ', () => {
      const r = recommendRefund(facts({ orderTotalSatang: FAST_REFUND_CEILING_SATANG + 1 }));
      expect(r.verdict).toBe('needs_review');
      expect(r.fault).toBe('restaurant'); // ยังบอกได้ว่าน่าจะเป็นความผิดใคร
    });

    it('ยอดพอดีเกณฑ์ยังเสนอคืนเต็มได้', () => {
      expect(recommendRefund(facts({ orderTotalSatang: FAST_REFUND_CEILING_SATANG })).verdict)
        .toBe('suggest_full');
    });

    /** เลขที่ระบบใส่มาให้จะกลายเป็นเลขที่แอดมินกดตามโดยไม่คิด */
    it('ตอนยังตัดสินไม่ได้ต้องไม่เสนอยอดมาให้กดตาม', () => {
      expect(recommendRefund(facts({ orderTotalSatang: 100_000 })).suggestedAmountSatang).toBeNull();
    });
  });

  describe('สัญญาณโกง', () => {
    it('ลูกค้าที่แจ้งปัญหาบ่อยผิดปกติถูกส่งให้คนดู', () => {
      const r = recommendRefund(facts({ customerOrderCount: 10, customerDisputeCount: 6 }));
      expect(r.verdict).toBe('needs_review');
      expect(r.reasoning.some((s) => s.includes('สูงผิดปกติ'))).toBe(true);
    });

    /** สั่ง 2 ครั้งแล้วมีปัญหา 1 ครั้ง = 50% แต่ไม่ได้แปลว่าโกง */
    it('ลูกค้าใหม่ที่ยังสั่งไม่กี่ครั้งไม่ถูกตัดสินจากสัดส่วน', () => {
      expect(recommendRefund(facts({ customerOrderCount: 2, customerDisputeCount: 1 })).verdict)
        .toBe('suggest_full');
    });

    /** สัญญาณโกงมีผลแค่ "ให้คนดูก่อน" ไม่ใช่ปฏิเสธเอง */
    it('แจ้งบ่อยผิดปกติก็ยังไม่ถูกปฏิเสธอัตโนมัติ', () => {
      expect(recommendRefund(facts({ customerOrderCount: 10, customerDisputeCount: 9 })).verdict)
        .not.toBe('not_eligible');
    });
  });

  describe('หลักฐานรูป', () => {
    it('ไรเดอร์มีรูปยืนยันการส่ง แต่ลูกค้าบอกไม่ได้รับ → ต้องให้คนเทียบรูป', () => {
      const r = recommendRefund(facts({ reason: 'not_delivered', hasDeliveryPhoto: true }));
      expect(r.verdict).toBe('needs_review');
      expect(r.reasoning.some((s) => s.includes('ขัดกับที่ลูกค้าแจ้ง'))).toBe(true);
    });

    /** ช่องโกงตรง ๆ ถ้าปล่อยผ่าน: อ้างว่าไม่ได้รับของทุกใบแล้วได้เงินคืนอัตโนมัติ */
    it('ไม่มีรูปยืนยันการส่ง แจ้งว่าไม่ได้รับ → ก็ยังต้องให้คนตัดสิน', () => {
      const r = recommendRefund(facts({ reason: 'not_delivered', hasDeliveryPhoto: false }));
      expect(r.verdict).toBe('needs_review');
      expect(r.suggestedAmountSatang).toBeNull();
    });

    it('"ไม่ได้รับของ" ไม่มีทางถูกเสนอคืนอัตโนมัติ ไม่ว่าเงื่อนไขอื่นจะสวยแค่ไหน', () => {
      for (const hasDeliveryPhoto of [true, false]) {
        const r = recommendRefund(facts({
          reason: 'not_delivered', hasDeliveryPhoto,
          orderTotalSatang: 1_000, customerOrderCount: 100, customerDisputeCount: 0,
        }));
        expect(r.verdict, String(hasDeliveryPhoto)).toBe('needs_review');
      }
    });

    it('บันทึกไว้เสมอว่าลูกค้าแนบรูปมาหรือไม่', () => {
      expect(recommendRefund(facts({ hasCustomerPhoto: false })).reasoning
        .some((s) => s.includes('ไม่ได้แนบรูป'))).toBe(true);
    });
  });

  /** ยอดคืนต้องไม่เกินที่ลูกค้าจ่ายมา ไม่ว่าทางไหน */
  it('ยอดที่เสนอไม่เกินยอดที่ลูกค้าจ่าย', () => {
    for (const total of [5_000, 12_345, FAST_REFUND_CEILING_SATANG]) {
      const r = recommendRefund(facts({ orderTotalSatang: total }));
      expect(r.suggestedAmountSatang ?? 0).toBeLessThanOrEqual(total);
    }
  });
});
