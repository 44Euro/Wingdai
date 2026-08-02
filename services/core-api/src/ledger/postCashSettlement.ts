import type { LedgerLine } from './postOrder';

/** ไรเดอร์นำเงินสดที่เก็บมาส่งคืนบริษัท (product-spec §6.2) */
export function postCashSettlement(args: { amountSatang: number }): LedgerLine[] {
  if (!Number.isInteger(args.amountSatang)) {
    throw new Error(`ยอดนำส่งต้องเป็นจำนวนเต็มสตางค์ ได้ ${args.amountSatang}`);
  }
  if (args.amountSatang <= 0) {
    throw new Error(`ยอดนำส่งต้องมากกว่าศูนย์ ได้ ${args.amountSatang}`);
  }

  return [
    { account: 'cash', debitSatang: args.amountSatang, creditSatang: 0 },
    { account: 'rider_cash_held', debitSatang: 0, creditSatang: args.amountSatang },
  ];
}
