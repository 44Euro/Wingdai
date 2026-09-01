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
  /** ค่าที่ไรเดอร์ได้จริง ไม่จำเป็นต้องเท่าค่าส่งที่เก็บจากลูกค้า */
  riderPaySatang: number;
  /** ค่าธรรมเนียมเกตเวย์ที่ถูกหักจริง เงินสดเป็น 0 (product-spec §6.5) */
  paymentFeeSatang: number;
  method: PaymentMethod;
  /** อัตราคอมที่ ออเดอร์ใบนี้ ใช้ตอนสร้าง (`orders.commission_rate_bp`) */
  commissionRateBp: number;
};

/** product-spec §6.2 แตกออเดอร์หนึ่งใบเป็นรายการบัญชีคู่ */
export function postOrderDelivered(a: OrderAmounts): LedgerLine[] {
  for (const [key, value] of Object.entries(a)) {
    if (typeof value === 'number' && !Number.isInteger(value)) {
      throw new Error(`${key} ต้องเป็นจำนวนเต็มสตางค์ ได้ ${value}`);
    }
  }

  const grossSatang = a.foodTotalSatang + a.deliveryFeeSatang + a.serviceFeeSatang;
  const commission = commissionOf(a.foodTotalSatang, a.commissionRateBp);
  const restaurantPayable = a.foodTotalSatang - commission;

  /** รายได้แพลตฟอร์ม = ยอดที่ลูกค้าจ่าย ลบส่วนที่เป็นของร้านและของไรเดอร์ */
  const platformRevenue = grossSatang - restaurantPayable - a.riderPaySatang;

  /** เงินที่บริษัทได้รับ "จริง" คือยอดหลังหักค่าธรรมเนียมเกตเวย์แล้ว */
  const receivedSatang = grossSatang - a.paymentFeeSatang;
  const collected: LedgerLine['account'] = a.method === 'cash' ? 'rider_cash_held' : 'cash';

  /** ข้ามบรรทัดที่ยอดเป็นศูนย์ ไม่ใช่ใส่ไว้ให้ครบรูปแบบ */
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
    // ออเดอร์ที่ขาดทุน (ค่าส่งที่เก็บน้อยกว่าที่จ่ายไรเดอร์) ยังต้องลงบัญชีให้ครบ
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
