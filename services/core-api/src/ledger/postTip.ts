import type { LedgerLine } from './postOrder';

/**
 * ทิปที่ลูกค้าให้ไรเดอร์หลังส่งถึงแล้ว (design C11, product-spec §6.2)
 *
 * ขาแรกเป็น `cash` เสมอ ไม่ใช่ `rider_cash_held` เพราะทิปเปิดให้กดได้ตอนออเดอร์ `delivered`
 * แล้วเท่านั้น ตอนนั้นไรเดอร์ออกจากหน้าบ้านไปแล้ว ไม่มีจังหวะไหนที่ลูกค้ายื่นเงินสดให้ได้
 * แม้ออเดอร์นั้นจะจ่ายปลายทางก็ตาม เงินสดก้อนนั้นเปลี่ยนมือไปก่อนงานปิดแล้ว
 *
 * ค่าธรรมเนียมเกตเวย์เป็นต้นทุนของแพลตฟอร์ม ไม่ใช่ของไรเดอร์ เขาได้เต็มยอดที่ลูกค้าตั้งใจให้
 * และไม่มีการหักคอมมิชชันจากทิปสักสตางค์
 */
export function postTip(args: {
  amountSatang: number;
  /** ค่าธรรมเนียมเกตเวย์ที่ถูกหักจากทิปก้อนนี้ */
  paymentFeeSatang: number;
}): LedgerLine[] {
  for (const [key, value] of Object.entries(args)) {
    if (!Number.isInteger(value)) {
      throw new Error(`${key} ต้องเป็นจำนวนเต็มสตางค์ ได้ ${value}`);
    }
  }
  if (args.amountSatang <= 0) {
    throw new Error(`ยอดทิปต้องมากกว่าศูนย์ ได้ ${args.amountSatang}`);
  }
  if (args.paymentFeeSatang < 0) {
    throw new Error(`ค่าธรรมเนียมติดลบไม่ได้ ได้ ${args.paymentFeeSatang}`);
  }
  // ค่าธรรมเนียมที่กินยอดทิปหมดแปลว่าตัวเลขผิด ปล่อยผ่านคือลงบัญชีเงินเข้าเป็นศูนย์หรือติดลบ
  if (args.paymentFeeSatang >= args.amountSatang) {
    throw new Error(
      `ค่าธรรมเนียม ${args.paymentFeeSatang} ต้องน้อยกว่ายอดทิป ${args.amountSatang}`,
    );
  }

  const lines: LedgerLine[] = [
    {
      account: 'cash',
      debitSatang: args.amountSatang - args.paymentFeeSatang,
      creditSatang: 0,
    },
  ];

  /** ข้ามบรรทัดที่ยอดเป็นศูนย์ ไม่ใช่ใส่ไว้ให้ครบรูปแบบ */
  if (args.paymentFeeSatang > 0) {
    lines.push({
      account: 'payment_fee_expense',
      debitSatang: args.paymentFeeSatang,
      creditSatang: 0,
    });
  }

  lines.push({ account: 'rider_payable', debitSatang: 0, creditSatang: args.amountSatang });

  return lines;
}
