/**
 * เวลาที่เหลือให้ไรเดอร์ตอบรับงาน (claude.md §6.3 — 15 วินาที)
 *
 * นับจาก `expiresAt` ที่เซิร์ฟเวอร์ส่งมา **ไม่ใช่นับถอยหลังจาก 15 ในเครื่อง**
 * เพราะนาฬิกาเครื่องไม่ตรงกับเซิร์ฟเวอร์ และคนที่ตัดสินว่าหมดเวลาแล้วคือเซิร์ฟเวอร์
 * ถ้าเครื่องนับเอง ไรเดอร์จะเห็นเลข 3 แต่กดแล้วโดนปฏิเสธว่าหมดเวลา ซึ่งอ่านเหมือนแอปพัง
 */
export const RESPOND_WINDOW_SECONDS = 15;

export function secondsLeftToRespond(expiresAt: string, now: number): number {
  const left = Math.ceil((new Date(expiresAt).getTime() - now) / 1000);
  return Math.min(RESPOND_WINDOW_SECONDS, Math.max(0, left));
}
