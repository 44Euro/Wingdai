import { describe, it, expect } from 'vitest';
import { postTip } from './postTip';
import { commissionOf } from '../db/schema/money';

const totals = (lines: ReturnType<typeof postTip>) => ({
  debit: lines.reduce((s, l) => s + l.debitSatang, 0),
  credit: lines.reduce((s, l) => s + l.creditSatang, 0),
});

describe('ทิปให้ไรเดอร์ (design C11)', () => {
  it('เดบิตเงินที่ลูกค้าจ่ายเข้ามา เครดิตหนี้ที่ค้างไรเดอร์', () => {
    expect(postTip({ amountSatang: 2_000 })).toEqual([
      { account: 'cash', debitSatang: 2_000, creditSatang: 0 },
      { account: 'rider_payable', debitSatang: 0, creditSatang: 2_000 },
    ]);
  });

  /** ข้อที่สำคัญที่สุดของไฟล์นี้ จอเขียนว่า "เข้าไรเดอร์เต็มจำนวน" */
  it('เข้าไรเดอร์ 100% ไม่หักคอมมิชชันสักสตางค์', () => {
    for (const amount of [100, 1_000, 2_000, 4_000, 10_000, 50_000]) {
      const lines = postTip({ amountSatang: amount });
      const toRider = lines
        .filter((l) => l.account === 'rider_payable')
        .reduce((s, l) => s + l.creditSatang - l.debitSatang, 0);
      expect(toRider).toBe(amount);
      // และต้องไม่มีบรรทัดรายได้บริษัทโผล่มาเลย ไม่ว่าจะยอดเท่าไหร่
      expect(lines.some((l) => l.account === 'platform_revenue')).toBe(false);
    }
  });

  /** ถ้าใครเผลอเอาทิปไปเข้าสูตรคอม 15% ค่าที่ได้จะไม่ใช่ศูนย์ เทสต์นี้ดักไว้ตรง ๆ */
  it('คอมมิชชันของทิปต้องเป็นศูนย์เสมอ ไม่ว่าอัตราจะเท่าไหร่', () => {
    const tip = 4_000;
    const lines = postTip({ amountSatang: tip });
    const riderGets = lines
      .filter((l) => l.account === 'rider_payable')
      .reduce((s, l) => s + l.creditSatang, 0);
    expect(tip - riderGets).toBe(0);
    // เทียบกับสิ่งที่จะเกิดถ้าคิดคอมจริง เพื่อให้เห็นว่าตัวเลขต่างกันจริง
    expect(commissionOf(tip, 1500)).toBeGreaterThan(0);
  });

  it('เดบิตเท่ากับเครดิตเสมอ ทุกยอดที่เป็นไปได้', () => {
    for (let i = 0; i < 500; i++) {
      const amount = 1 + Math.floor(Math.random() * 100_000);
      const t = totals(postTip({ amountSatang: amount }));
      expect(t.debit).toBe(t.credit);
      expect(t.debit).toBe(amount);
    }
  });

  /** ทิปไม่มีทางจ่ายสด ไรเดอร์ออกจากหน้าบ้านไปแล้วตอนลูกค้ากดให้ */
  it('ขาแรกเป็น cash เสมอ ไม่ใช่เงินสดในมือไรเดอร์', () => {
    const lines = postTip({ amountSatang: 2_000 });
    expect(lines.some((l) => l.account === 'rider_cash_held')).toBe(false);
    expect(lines[0]!.account).toBe('cash');
  });

  it('ยอดที่ไม่ใช่จำนวนเต็มสตางค์ถูกปฏิเสธ', () => {
    expect(() => postTip({ amountSatang: 20.5 })).toThrow();
  });

  it('ยอดศูนย์หรือติดลบถูกปฏิเสธ — ไม่ให้ทิปคือไม่เรียกฟังก์ชันนี้', () => {
    expect(() => postTip({ amountSatang: 0 })).toThrow();
    expect(() => postTip({ amountSatang: -100 })).toThrow();
  });
});
