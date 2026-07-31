import type { LedgerLine } from './postOrder';
import type { refundFault } from '../db/schema/enums';

export type RefundFault = (typeof refundFault.enumValues)[number];

/** product-spec §6.4 คืนเงินหนึ่งครั้งเป็นรายการบัญชีคู่ */
export function postRefund(args: { amountSatang: number; fault: RefundFault }): LedgerLine[] {
  if (!Number.isInteger(args.amountSatang)) {
    throw new Error(`ยอดคืนเงินต้องเป็นจำนวนเต็มสตางค์ ได้ ${args.amountSatang}`);
  }
  if (args.amountSatang <= 0) {
    throw new Error(`ยอดคืนเงินต้องมากกว่าศูนย์ ได้ ${args.amountSatang}`);
  }

  const bearer: Record<RefundFault, LedgerLine['account']> = {
    restaurant: 'restaurant_payable',
    rider: 'rider_payable',
    platform: 'refund_expense',
  };

  return [
    { account: bearer[args.fault], debitSatang: args.amountSatang, creditSatang: 0 },
    { account: 'cash', debitSatang: 0, creditSatang: args.amountSatang },
  ];
}
