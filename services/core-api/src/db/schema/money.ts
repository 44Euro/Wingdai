import { integer } from 'drizzle-orm/pg-core';

/** เงินทุกช่องในฐานข้อมูลต้องผ่านตัวนี้ (product-spec §5 กติกาข้อ 1 §7) */
export const satang = (name: string) => integer(name);

/** GP ตั้งต้น 15% คิดจากค่าอาหารเท่านั้น ไม่รวมค่าส่ง/ค่าบริการ (product-spec §6.1) */
export const DEFAULT_COMMISSION_RATE_BP = 1500; // basis points — จำนวนเต็มด้วยเหตุผลเดียวกับ satang

/** ค่าคอมมิชชันของยอดอาหารหนึ่งก้อน ทุกค่าเป็นสตางค์ */
export function commissionOf(
  foodTotalSatang: number,
  rateBp: number = DEFAULT_COMMISSION_RATE_BP,
): number {
  if (!Number.isInteger(foodTotalSatang)) {
    throw new Error(`ค่าอาหารต้องเป็นจำนวนเต็มสตางค์ ได้ ${foodTotalSatang}`);
  }
  if (!Number.isInteger(rateBp) || rateBp < 0) {
    throw new Error(`อัตราค่าคอมต้องเป็นจำนวนเต็ม basis point ที่ไม่ติดลบ ได้ ${rateBp}`);
  }
  // ปัดลงเสมอ ส่วนที่ปัดทิ้งตกเป็นของร้าน ไม่ใช่ของแพลตฟอร์ม
  return Math.floor((foodTotalSatang * rateBp) / 10000);
}
