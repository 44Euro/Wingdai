/**
 * หน้าต่างเวลาที่ร้าน "ควร" กดรับออร์เดอร์ (design M2/M3 — จอนับถอยหลัง ⭐)
 *
 * **หมดเวลาแล้วไม่มีอะไรถูกยกเลิกอัตโนมัติ** และนี่เป็นการตัดสินใจ ไม่ใช่ของที่ยังทำไม่เสร็จ
 * claude.md ไม่ได้กำหนดกติกาว่าเกิน 60 วินาทีแล้วต้องทำอะไร การยกเลิกออร์เดอร์ของลูกค้า
 * ทิ้งเพราะร้านช้าไป 1 วินาที เป็นการตัดสินใจเรื่องเงินและความไว้ใจ ที่โค้ดไม่ควรคิดแทน
 *
 * ตัวเลขนี้จึงเป็น "ตัวเร่ง" ที่ทำให้ครัวเห็นว่าใบไหนรอนาน (§8 อัตราการรับออร์เดอร์ > 95%)
 * ส่วนใบที่เกินเวลาไปแล้วเป็นงานของหน้าจอแอดมินแบบ exception-based (§7) ซึ่งอยู่คลื่นที่ 5
 */
export const ACCEPT_WINDOW_SECONDS = 60;

/**
 * เหลือกี่วินาที — บีบให้อยู่ในช่วง 0 ถึง ACCEPT_WINDOW_SECONDS เสมอ
 *
 * ขอบบนสำคัญพอ ๆ กับขอบล่าง เพราะนาฬิกาเครื่องร้านอาจเดินช้ากว่าเซิร์ฟเวอร์
 * ทำให้ createdAt ดูเหมือนอยู่ในอนาคต แล้วครัวจะเห็น "72 วินาที" ซึ่งไม่มีทางเป็นจริง
 */
export function secondsLeftToAccept(createdAt: string, now: number): number {
  const elapsed = (now - new Date(createdAt).getTime()) / 1000;
  const left = Math.ceil(ACCEPT_WINDOW_SECONDS - elapsed);
  return Math.min(ACCEPT_WINDOW_SECONDS, Math.max(0, left));
}

export type AcceptUrgency = 'calm' | 'urgent' | 'late';

/**
 * ระดับความเร่ง — ใช้เลือกสีและข้อความ ไม่ได้ใช้ตัดสินใจอะไรที่มีผลกับเงิน
 * 15 วินาทีสุดท้ายเป็น "urgent" เท่ากับเวลาที่ไรเดอร์มีให้ตอบรับงาน (§6.3) โดยตั้งใจ
 */
export function acceptUrgency(secondsLeft: number): AcceptUrgency {
  if (secondsLeft === 0) return 'late';
  return secondsLeft <= 15 ? 'urgent' : 'calm';
}
