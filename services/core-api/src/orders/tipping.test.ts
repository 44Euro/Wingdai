import { describe, it, expect } from 'vitest';
import { assertCanTip, MAX_TIP_SATANG } from './tipping';

const delivered = {
  customerId: 'u1',
  riderId: 'r1',
  status: 'delivered' as const,
  tipSatang: 0,
};

const tip = (over: Partial<Parameters<typeof assertCanTip>[0]> = {}) =>
  assertCanTip({ viewerId: 'u1', order: delivered, amountSatang: 2_000, ...over });

describe('ให้ทิปได้เมื่อไหร่ (design C11)', () => {
  it('ลูกค้าเจ้าของออเดอร์ที่ส่งถึงแล้ว ให้ทิปได้', () => {
    expect(() => tip()).not.toThrow();
  });

  it('คนอื่นให้ทิปแทนไม่ได้', () => {
    expect(() => tip({ viewerId: 'u2' })).toThrow(/ของตัวเอง/);
  });

  /** ทิปคือคำขอบคุณสำหรับงานที่เสร็จแล้ว ให้ก่อนได้เมื่อไรมันกลายเป็นเงินมัดจำ */
  it('ยังไม่ส่งถึง ให้ทิปไม่ได้', () => {
    for (const status of ['created', 'accepted', 'preparing', 'picked_up'] as const) {
      expect(() => tip({ order: { ...delivered, status } })).toThrow(/หลังจากได้รับอาหาร/);
    }
  });

  it('ใบที่ยกเลิกแล้วให้ทิปไม่ได้', () => {
    expect(() => tip({ order: { ...delivered, status: 'cancelled' } }))
      .toThrow(/หลังจากได้รับอาหาร/);
  });

  /** ไม่มีไรเดอร์ = เงินจะค้างในบัญชีบริษัทโดยไม่มีเจ้าของ */
  it('ออเดอร์ที่ไม่มีไรเดอร์ ให้ทิปไม่ได้', () => {
    expect(() => tip({ order: { ...delivered, riderId: null } })).toThrow(/ไม่มีไรเดอร์/);
  });

  it('ให้ซ้ำใบเดิมไม่ได้ — ledger ของทิปเขียนไปแล้วและย้อนไม่ได้', () => {
    expect(() => tip({ order: { ...delivered, tipSatang: 2_000 } })).toThrow(/ให้ทิปไปแล้ว/);
  });

  it('ยอดศูนย์หรือติดลบไม่ผ่าน — ไม่ให้ทิปคือไม่เรียกเส้นทางนี้เลย', () => {
    expect(() => tip({ amountSatang: 0 })).toThrow();
    expect(() => tip({ amountSatang: -100 })).toThrow();
  });

  it('ยอดที่ไม่ใช่จำนวนเต็มสตางค์ไม่ผ่าน (§5 กฎข้อ 1)', () => {
    expect(() => tip({ amountSatang: 20.5 })).toThrow();
  });

  /** กันนิ้วลั่นกับไคลเอนต์ที่ถูกดัดแปลง ทิปกลายเป็นหนี้จริงที่บริษัทต้องจ่าย */
  it('เกินเพดานไม่ผ่าน แต่เท่าเพดานพอดีผ่าน', () => {
    expect(() => tip({ amountSatang: MAX_TIP_SATANG + 1 })).toThrow(/สูงสุด/);
    expect(() => tip({ amountSatang: MAX_TIP_SATANG })).not.toThrow();
  });
});
