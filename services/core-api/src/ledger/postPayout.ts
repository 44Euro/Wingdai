import type { LedgerLine } from './postOrder';

/** จ่ายรายได้ให้ไรเดอร์ (product-spec §6.2) */
export function postPayout(args: { amountSatang: number }): LedgerLine[] {
  if (!Number.isInteger(args.amountSatang)) {
    throw new Error(`ยอดจ่ายต้องเป็นจำนวนเต็มสตางค์ ได้ ${args.amountSatang}`);
  }
  if (args.amountSatang <= 0) {
    throw new Error(`ยอดจ่ายต้องมากกว่าศูนย์ ได้ ${args.amountSatang}`);
  }

  return [
    { account: 'rider_payable', debitSatang: args.amountSatang, creditSatang: 0 },
    { account: 'cash', debitSatang: 0, creditSatang: args.amountSatang },
  ];
}

/** ยอดที่ไรเดอร์ถอนได้จริง = รายได้ค้างจ่าย − เงินสดที่ถืออยู่ */
export function withdrawableSatang(args: {
  payableSatang: number;
  cashHeldSatang: number;
}): number {
  return args.payableSatang - args.cashHeldSatang;
}

export function assertWithdrawAllowed(args: {
  amountSatang: number;
  payableSatang: number;
  cashHeldSatang: number;
}): void {
  if (!Number.isInteger(args.amountSatang)) {
    throw new Error(`ยอดถอนต้องเป็นจำนวนเต็มสตางค์ ได้ ${args.amountSatang}`);
  }
  if (args.amountSatang <= 0) {
    throw new Error('ยอดถอนต้องมากกว่าศูนย์');
  }
  const available = withdrawableSatang(args);
  if (args.amountSatang > available) {
    throw new Error(`ถอนได้ไม่เกิน ${available} สตางค์ ขอมา ${args.amountSatang}`);
  }
}
