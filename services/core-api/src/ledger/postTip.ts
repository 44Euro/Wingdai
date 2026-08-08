import type { LedgerLine } from './postOrder';

/** ทิปที่ลูกค้าให้ไรเดอร์หลังส่งถึงแล้ว (design C11) */
export function postTip(args: { amountSatang: number }): LedgerLine[] {
  if (!Number.isInteger(args.amountSatang)) {
    throw new Error(`ยอดทิปต้องเป็นจำนวนเต็มสตางค์ ได้ ${args.amountSatang}`);
  }
  if (args.amountSatang <= 0) {
    throw new Error(`ยอดทิปต้องมากกว่าศูนย์ ได้ ${args.amountSatang}`);
  }

  return [
    { account: 'cash', debitSatang: args.amountSatang, creditSatang: 0 },
    { account: 'rider_payable', debitSatang: 0, creditSatang: args.amountSatang },
  ];
}
