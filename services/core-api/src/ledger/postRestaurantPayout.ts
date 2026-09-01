import type { LedgerLine } from './postOrder';

/** รอบจ่ายเงินร้าน (product-spec §6.2 "Weekly payout run: debit restaurant_payable → credit cash") */
export function postRestaurantPayout(args: { amountSatang: number }): LedgerLine[] {
  if (!Number.isInteger(args.amountSatang)) {
    throw new Error(`ยอดจ่ายต้องเป็นจำนวนเต็มสตางค์ ได้ ${args.amountSatang}`);
  }
  if (args.amountSatang <= 0) {
    throw new Error(`ยอดจ่ายต้องมากกว่าศูนย์ ได้ ${args.amountSatang}`);
  }

  return [
    { account: 'restaurant_payable', debitSatang: args.amountSatang, creditSatang: 0 },
    { account: 'cash', debitSatang: 0, creditSatang: args.amountSatang },
  ];
}

/** จ่ายเกินยอดที่ค้างจริงไม่ได้ */
export function assertRestaurantPayoutAllowed(args: {
  amountSatang: number;
  payableSatang: number;
}): void {
  if (!Number.isInteger(args.amountSatang)) {
    throw new Error(`ยอดจ่ายต้องเป็นจำนวนเต็มสตางค์ ได้ ${args.amountSatang}`);
  }
  if (args.amountSatang <= 0) {
    throw new Error('ยอดจ่ายต้องมากกว่าศูนย์ — ร้านนี้ไม่มียอดค้างให้จ่าย');
  }
  if (args.amountSatang > args.payableSatang) {
    throw new Error(`จ่ายได้ไม่เกิน ${args.payableSatang} สตางค์ ขอมา ${args.amountSatang}`);
  }
}

/**
 * ยอดที่ร้าน ถอนเองได้ = ยอดค้างจ่าย − ใบที่ขอไว้แล้วแต่ทีมงานยังไม่ตัดสิน
 * ต่างจาก assertRestaurantPayoutAllowed ที่เป็นมุมของแอดมินตอนกดจ่ายทั้งก้อน (AD7)
 * ตรงที่ต้องกันไม่ให้ร้านกดขอซ้อนกันจนรวมแล้วเกินยอดที่มีจริง
 */
export function merchantWithdrawableSatang(args: {
  payableSatang: number;
  pendingSatang: number;
}): number {
  return args.payableSatang - args.pendingSatang;
}

export function assertMerchantWithdrawAllowed(args: {
  amountSatang: number;
  payableSatang: number;
  pendingSatang: number;
}): void {
  if (!Number.isInteger(args.amountSatang)) {
    throw new Error(`ยอดถอนต้องเป็นจำนวนเต็มสตางค์ ได้ ${args.amountSatang}`);
  }
  if (args.amountSatang <= 0) {
    throw new Error('ยอดถอนต้องมากกว่าศูนย์');
  }
  const available = merchantWithdrawableSatang(args);
  if (args.amountSatang > available) {
    throw new Error(`ถอนได้ไม่เกิน ${available} สตางค์ ขอมา ${args.amountSatang}`);
  }
}
