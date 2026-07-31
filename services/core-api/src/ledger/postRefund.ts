import type { LedgerLine } from './postOrder';
import type { refundFault } from '../db/schema/enums';

export type RefundFault = (typeof refundFault.enumValues)[number];

/**
 * claude.md §6.4 — คืนเงินหนึ่งครั้งเป็นรายการบัญชีคู่
 *
 * **เป็นรายการกลับทาง ไม่ใช่การแก้แถวเดิม** (§6.2 ledger เขียนอย่างเดียว)
 * และต้องออกจากระบบตอนแอดมินกดยืนยันเสมอ ห้ามมีใครไปแก้ยอดนอกระบบ
 *
 * เงินไหลออกจากบริษัทไปหาลูกค้าเสมอ (เครดิต `cash`) ส่วน **ใครรับผิดชอบต้นทุน**
 * คือขาเดบิต ซึ่งเป็นเหตุผลที่ §6.4 สั่งให้เก็บ fault ไว้บนใบคืนเงิน —
 * ไม่ใช่ไว้ทำรายงานอย่างเดียว แต่เพราะมันเปลี่ยนว่าใครเสียเงินจริง ๆ
 *
 *   ของผิด/ของขาด        → ร้านรับ  → ลดยอดค้างจ่ายร้าน
 *   หกเสียหายระหว่างส่ง   → ไรเดอร์รับ → ลดยอดค้างจ่ายไรเดอร์
 *   ระบบ/แพลตฟอร์มพลาด   → บริษัทรับ  → ลงเป็นค่าใช้จ่าย
 */
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
