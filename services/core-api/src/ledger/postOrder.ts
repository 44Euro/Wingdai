import { commissionOf } from '../db/schema/money';
import type { paymentMethod } from '../db/schema/enums';

export type PaymentMethod = (typeof paymentMethod.enumValues)[number];

export type LedgerLine = {
  account:
    | 'cash'
    | 'restaurant_payable'
    | 'rider_payable'
    | 'rider_cash_held'
    | 'payment_fee_expense'
    | 'platform_revenue'
    | 'refund_expense';
  debitSatang: number;
  creditSatang: number;
};

export type OrderAmounts = {
  foodTotalSatang: number;
  deliveryFeeSatang: number;
  serviceFeeSatang: number;
  /** ค่าที่ไรเดอร์ได้จริง — ไม่จำเป็นต้องเท่าค่าส่งที่เก็บจากลูกค้า */
  riderPaySatang: number;
  /** ค่าธรรมเนียมเกตเวย์ที่ถูกหักจริง — เงินสดเป็น 0 (claude.md §6.5) */
  paymentFeeSatang: number;
  method: PaymentMethod;
};

/**
 * claude.md §6.2 — แตกออร์เดอร์หนึ่งใบเป็นรายการบัญชีคู่
 *
 * ต่างกันแค่ขาแรก: จ่ายผ่านเกตเวย์เงินเข้าบริษัทตรง ๆ (`cash`)
 * แต่จ่ายเงินสดคือไรเดอร์ถือเงินบริษัทไว้ (`rider_cash_held`) แล้วไปหักกลบตอนรอบจ่ายเงิน
 * นี่คือเหตุผลว่าทำไมไรเดอร์ไม่ต้องออกเงินค่าอาหารเอง — เขาแค่เก็บ ไม่ได้จ่าย
 */
export function postOrderDelivered(a: OrderAmounts): LedgerLine[] {
  for (const [key, value] of Object.entries(a)) {
    if (typeof value === 'number' && !Number.isInteger(value)) {
      throw new Error(`${key} ต้องเป็นจำนวนเต็มสตางค์ ได้ ${value}`);
    }
  }

  const grossSatang = a.foodTotalSatang + a.deliveryFeeSatang + a.serviceFeeSatang;
  const commission = commissionOf(a.foodTotalSatang);
  const restaurantPayable = a.foodTotalSatang - commission;

  /**
   * รายได้แพลตฟอร์ม = ยอดที่ลูกค้าจ่าย ลบส่วนที่เป็นของร้านและของไรเดอร์
   * **ไม่ลบค่าธรรมเนียมเกตเวย์ตรงนี้** เพราะค่าธรรมเนียมเป็น "ค่าใช้จ่าย" มีบรรทัดของตัวเอง
   * ถ้าเอาไปลบออกจากบรรทัดรายได้ ค่าธรรมเนียมจะโดนนับสองรอบ แล้วเดบิตกับเครดิตจะไม่ตรงกัน
   *
   * คิดเป็นเศษที่เหลือ ไม่ได้ตั้งสูตรแยก เพื่อให้บาลานซ์เสมอโดยไม่ต้องลุ้นเรื่องปัดเศษ
   */
  const platformRevenue = grossSatang - restaurantPayable - a.riderPaySatang;

  /**
   * เงินที่บริษัทได้รับ "จริง" คือยอดหลังหักค่าธรรมเนียมเกตเวย์แล้ว
   * เกตเวย์หักตั้งแต่ก่อนโอนเข้าบัญชีเรา ไม่ได้ให้เต็มแล้วมาเก็บทีหลัง
   *
   * ตรงนี้ต่างจากตารางตัวอย่างใน claude.md §6.2 ที่เดบิต cash เต็ม ฿170
   * ตารางนั้นยังบาลานซ์อยู่ก็จริง แต่ทำให้บรรทัดรายได้สูงเกินจริงไป ฿1.36
   * และทำให้เงินสดกับพร้อมเพย์ดูเหมือนได้กำไรเท่ากัน ซึ่งขัดกับ §6.5 ที่บอกว่า
   * ค่าธรรมเนียมต่างกันมีผลกับ unit economics — แบบนี้ตัวเลขถึงจะสะท้อนความจริง
   */
  const receivedSatang = grossSatang - a.paymentFeeSatang;
  const collected: LedgerLine['account'] = a.method === 'cash' ? 'rider_cash_held' : 'cash';

  /**
   * ข้ามบรรทัดที่ยอดเป็นศูนย์ ไม่ใช่ใส่ไว้ให้ครบรูปแบบ
   *
   * ตาราง ledger_entries มี CHECK ว่าแต่ละแถวต้องเป็นเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง
   * และต้องมากกว่าศูนย์ — แถวที่เป็น 0 ทั้งสองข้างจะถูกฐานปฏิเสธ แล้วพาทั้งทรานแซกชันล้ม
   * ซึ่งหมายถึงเปลี่ยนสถานะเป็น delivered ไม่ได้เลย
   *
   * เจอตอนออร์เดอร์ที่ยังไม่มีไรเดอร์ (คลื่นที่ 4 ยังไม่มา) ซึ่ง rider_payable = 0
   */
  const lines: LedgerLine[] = [
    { account: collected, debitSatang: receivedSatang, creditSatang: 0 },
    { account: 'restaurant_payable', debitSatang: 0, creditSatang: restaurantPayable },
  ];

  if (a.riderPaySatang > 0) {
    lines.push({ account: 'rider_payable', debitSatang: 0, creditSatang: a.riderPaySatang });
  }

  if (a.paymentFeeSatang > 0) {
    lines.push({ account: 'payment_fee_expense', debitSatang: a.paymentFeeSatang, creditSatang: 0 });
  }

  if (platformRevenue > 0) {
    lines.push({ account: 'platform_revenue', debitSatang: 0, creditSatang: platformRevenue });
  } else if (platformRevenue < 0) {
    // ออร์เดอร์ที่ขาดทุน (ค่าส่งที่เก็บน้อยกว่าที่จ่ายไรเดอร์) ยังต้องลงบัญชีให้ครบ
    // claude.md §8 บอกว่า contribution margin ต้องเป็นบวกทุกใบ — ถ้าติดลบคือสัญญาณให้แก้ราคา ไม่ใช่ให้ซ่อน
    lines.push({ account: 'platform_revenue', debitSatang: -platformRevenue, creditSatang: 0 });
  }

  return lines;
}

export function totalsOf(lines: LedgerLine[]) {
  return lines.reduce(
    (acc, l) => ({
      debit: acc.debit + l.debitSatang,
      credit: acc.credit + l.creditSatang,
    }),
    { debit: 0, credit: 0 },
  );
}
