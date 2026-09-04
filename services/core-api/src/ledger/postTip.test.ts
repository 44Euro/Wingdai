import { describe, it, expect } from 'vitest';
import { postTip } from './postTip';
import { commissionOf } from '../db/schema/money';

const totals = (lines: ReturnType<typeof postTip>) => ({
  debit: lines.reduce((s, l) => s + l.debitSatang, 0),
  credit: lines.reduce((s, l) => s + l.creditSatang, 0),
});

const noFee = (amountSatang: number) => postTip({ amountSatang, paymentFeeSatang: 0 });

describe('ทิปให้ไรเดอร์ (design C11)', () => {
  it('เดบิตเงินที่ลูกค้าจ่ายเข้ามา เครดิตหนี้ที่ค้างไรเดอร์', () => {
    expect(noFee(2_000)).toEqual([
      { account: 'cash', debitSatang: 2_000, creditSatang: 0 },
      { account: 'rider_payable', debitSatang: 0, creditSatang: 2_000 },
    ]);
  });

  /** ข้อที่สำคัญที่สุดของไฟล์นี้ จอเขียนว่า "เข้าไรเดอร์เต็มจำนวน" */
  it('เข้าไรเดอร์ 100% ไม่หักคอมมิชชันสักสตางค์', () => {
    for (const amount of [100, 1_000, 2_000, 4_000, 10_000, 50_000]) {
      const lines = noFee(amount);
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
    const riderGets = noFee(tip)
      .filter((l) => l.account === 'rider_payable')
      .reduce((s, l) => s + l.creditSatang, 0);
    expect(tip - riderGets).toBe(0);
    // เทียบกับสิ่งที่จะเกิดถ้าคิดคอมจริง เพื่อให้เห็นว่าตัวเลขต่างกันจริง
    expect(commissionOf(tip, 1500)).toBeGreaterThan(0);
  });

  it('เดบิตเท่ากับเครดิตเสมอ ทุกยอดที่เป็นไปได้', () => {
    for (let i = 0; i < 500; i++) {
      const amount = 1 + Math.floor(Math.random() * 100_000);
      const t = totals(noFee(amount));
      expect(t.debit).toBe(t.credit);
      expect(t.debit).toBe(amount);
    }
  });

  /**
   * ทิปไม่มีทางจ่ายสด ทิปเปิดให้กดตอนออเดอร์ `delivered` แล้ว ไรเดอร์ออกจากหน้าบ้านไปแล้ว
   * จริงแม้กับออเดอร์ที่จ่ายปลายทาง เพราะเงินก้อนนั้นเปลี่ยนมือไปก่อนงานปิด
   */
  it('ขาแรกเป็น cash เสมอ ไม่ใช่เงินสดในมือไรเดอร์', () => {
    const lines = noFee(2_000);
    expect(lines.some((l) => l.account === 'rider_cash_held')).toBe(false);
    expect(lines[0]!.account).toBe('cash');
  });

  it('ยอดที่ไม่ใช่จำนวนเต็มสตางค์ถูกปฏิเสธ', () => {
    expect(() => noFee(20.5)).toThrow();
  });

  it('ยอดศูนย์หรือติดลบถูกปฏิเสธ — ไม่ให้ทิปคือไม่เรียกฟังก์ชันนี้', () => {
    expect(() => noFee(0)).toThrow();
    expect(() => noFee(-100)).toThrow();
  });
});

describe('ค่าธรรมเนียมเกตเวย์ของทิป (product-spec §6.2)', () => {
  /** §6.2 เกตเวย์ไม่เคยโอนยอดเต็มมาให้ ค่าธรรมเนียมต้องโผล่เป็นค่าใช้จ่าย ไม่ใช่ไปหดเครดิตไรเดอร์ */
  it('เดบิตเงินสดเท่ายอดสุทธิ และแยกค่าธรรมเนียมเป็นค่าใช้จ่าย', () => {
    expect(postTip({ amountSatang: 5_000, paymentFeeSatang: 90 })).toEqual([
      { account: 'cash', debitSatang: 4_910, creditSatang: 0 },
      { account: 'payment_fee_expense', debitSatang: 90, creditSatang: 0 },
      { account: 'rider_payable', debitSatang: 0, creditSatang: 5_000 },
    ]);
  });

  it('ไรเดอร์ได้เต็มยอดทิปเสมอ ค่าธรรมเนียมเป็นต้นทุนของแพลตฟอร์ม', () => {
    for (const fee of [0, 1, 90, 999]) {
      const credited = postTip({ amountSatang: 5_000, paymentFeeSatang: fee })
        .filter((l) => l.account === 'rider_payable')
        .reduce((s, l) => s + l.creditSatang, 0);
      expect(credited).toBe(5_000);
    }
  });

  it('เดบิตเท่าเครดิตแม้มีค่าธรรมเนียม', () => {
    for (const amount of [100, 2_000, 12_345, 50_000]) {
      const fee = Math.floor(amount * 0.018);
      const t = totals(postTip({ amountSatang: amount, paymentFeeSatang: fee }));
      expect(t.debit).toBe(t.credit);
      expect(t.debit).toBe(amount);
    }
  });

  it('ค่าธรรมเนียมศูนย์ไม่ต้องมีบรรทัดค่าใช้จ่ายให้ครบรูปแบบ', () => {
    expect(noFee(5_000).some((l) => l.account === 'payment_fee_expense')).toBe(false);
  });

  it('ค่าธรรมเนียมที่กินยอดทิปทั้งก้อนถูกปฏิเสธ ไม่ใช่ลงบัญชีเงินเข้าศูนย์หรือติดลบ', () => {
    expect(() => postTip({ amountSatang: 100, paymentFeeSatang: 100 })).toThrow();
    expect(() => postTip({ amountSatang: 100, paymentFeeSatang: 150 })).toThrow();
  });

  it('ค่าธรรมเนียมติดลบหรือไม่เป็นจำนวนเต็มถูกปฏิเสธ', () => {
    expect(() => postTip({ amountSatang: 5_000, paymentFeeSatang: -1 })).toThrow();
    expect(() => postTip({ amountSatang: 5_000, paymentFeeSatang: 1.5 })).toThrow();
  });
});
