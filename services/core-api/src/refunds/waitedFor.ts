/**
 * ระยะเวลาที่ออเดอร์ค้างอยู่ เขียนให้อ่านออกโดยไม่ต้องนับเอง
 *
 * จอแอดมินเคยขึ้นว่า "ร้านยังไม่กดรับมา 219 นาที" ซึ่งต้องแปลงในหัวเองว่ากี่ชั่วโมง
 * และใบที่ค้างข้ามคืนทำให้เลขไปถึงหลักพันได้ง่าย ๆ
 */
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function waitedFor(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));

  if (total < MINUTES_PER_HOUR) return `${total} นาที`;

  if (total < MINUTES_PER_DAY) {
    const hours = Math.floor(total / MINUTES_PER_HOUR);
    const rest = total % MINUTES_PER_HOUR;
    return rest === 0 ? `${hours} ชม.` : `${hours} ชม. ${rest} นาที`;
  }

  const days = Math.floor(total / MINUTES_PER_DAY);
  const hours = Math.floor((total % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  return hours === 0 ? `${days} วัน` : `${days} วัน ${hours} ชม.`;
}
