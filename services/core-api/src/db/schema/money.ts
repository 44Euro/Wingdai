import { integer } from 'drizzle-orm/pg-core';

/**
 * เงินทุกช่องในฐานข้อมูลต้องผ่านตัวนี้ (claude.md §5 กติกาข้อ 1 · §7)
 *
 * หน่วยเป็น "สตางค์" เป็นจำนวนเต็มเสมอ — ห้าม numeric/decimal/float แม้แต่ช่องเดียว
 * ใช้ helper นี้แทนการเรียก integer() ตรง ๆ เพื่อให้ grep เจอทุกช่องที่เป็นเงินได้ในคำเดียว
 * และเพื่อให้คนที่มาอ่านทีหลังรู้ทันทีว่า 15000 คือ ฿150.00 ไม่ใช่ ฿15,000
 */
export const satang = (name: string) => integer(name);

/** GP 15% คิดจากค่าอาหารเท่านั้น ไม่รวมค่าส่ง/ค่าบริการ (claude.md §6.1) */
export const COMMISSION_RATE_BP = 1500; // basis points — เก็บเป็นจำนวนเต็มด้วยเหตุผลเดียวกับ satang

/**
 * แตกยอดออร์เดอร์เป็นบรรทัดบัญชี — ทุกค่าเป็นสตางค์
 * ผลรวมเดบิตต้องเท่ากับเครดิตเสมอ ไม่งั้น ledger พัง (claude.md §6.2)
 */
export function commissionOf(foodTotalSatang: number): number {
  if (!Number.isInteger(foodTotalSatang)) {
    throw new Error(`ค่าอาหารต้องเป็นจำนวนเต็มสตางค์ ได้ ${foodTotalSatang}`);
  }
  // ปัดลงเสมอ — ส่วนที่ปัดทิ้งตกเป็นของร้าน ไม่ใช่ของแพลตฟอร์ม
  return Math.floor((foodTotalSatang * COMMISSION_RATE_BP) / 10000);
}
