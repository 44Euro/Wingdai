import type { LedgerLine } from './postOrder';

/**
 * ไรเดอร์นำเงินสดที่เก็บมาส่งคืนบริษัท (claude.md §6.2)
 *
 * ตอนลูกค้าจ่ายเงินสด เงินก้อนนั้น **เป็นของแพลตฟอร์มตั้งแต่วินาทีแรก** แค่บังเอิญ
 * อยู่ในกระเป๋าไรเดอร์ — postOrder จึงเดบิต `rider_cash_held` ซึ่งเป็นบัญชีทรัพย์สิน
 * "เงินบริษัทที่ฝากอยู่กับไรเดอร์" ไม่ใช่หนี้ที่ไรเดอร์ติดบริษัท
 *
 * พอไรเดอร์เอาเงินมาคืน เงินย้ายจากกระเป๋าไรเดอร์เข้าบริษัท:
 *   เดบิต  cash             — บริษัทได้เงินจริงเข้ามา
 *   เครดิต rider_cash_held  — ยอดที่ฝากอยู่กับไรเดอร์ลดลง
 *
 * **นี่คือขาที่หายไปทั้งระบบก่อนหน้านี้** `cash_held_satang` มีแต่ทางเพิ่ม ไม่มีทางลด
 * แปลว่าไรเดอร์ที่ส่งงานเงินสดครบเพดาน (฿1,500) จะถูกตัดจากงานเงินสดถาวร
 * เพราะ eligibility.ts กันไว้ และไม่มีทางไหนเลยที่จะเคลียร์ยอดนั้นได้
 */
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
