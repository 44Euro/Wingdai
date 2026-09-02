/**
 * ออเดอร์ต่อชั่วโมงของไรเดอร์ (product-spec §8)
 *
 * ตัวเลขชั่วโมงที่ส่งออกไปถูกปัดสองตำแหน่ง การตัดสินว่า "วัดได้หรือยัง" จึงต้องดูค่าที่ปัดแล้ว
 * ไม่ใช่ค่าดิบ ไรเดอร์ที่เพิ่งกดออนไลน์สามวินาทีมีชั่วโมงดิบ 0.0008 ซึ่งมากกว่าศูนย์
 * แต่รายงานออกไปเป็น 0.00 ชั่วโมง ถ้าหารด้วยค่าดิบจะได้ 0 งาน/ชม. ซึ่งอ่านเหมือน "ทำได้แย่"
 * ทั้งที่ความจริงคือยังไม่มีเวลามากพอจะวัด
 */
export function riderRate(rawHours: number, delivered: number): {
  hours: number;
  delivered: number;
  ordersPerHour: number | null;
} {
  const hours = Number(rawHours.toFixed(2));
  return {
    hours,
    delivered,
    // หารด้วยชั่วโมงดิบเพื่อไม่ให้ความคลาดจากการปัดไหลเข้าไปในอัตรา
    ordersPerHour: hours > 0 ? Number((delivered / rawHours).toFixed(2)) : null,
  };
}
