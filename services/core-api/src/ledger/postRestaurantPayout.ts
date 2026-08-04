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
