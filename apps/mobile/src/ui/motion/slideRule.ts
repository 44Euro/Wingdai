/** กติกาของ "เลื่อนเพื่อยืนยัน" (design R3) */

/** ต้องลากถึงกี่ส่วนของราง ถึงจะนับว่ายืนยัน ต่ำกว่านี้ดีดกลับ */
export const COMMIT_RATIO = 0.75;

/** ระยะที่หัวปุ่มขยับได้จริง รางแคบกว่าหัวปุ่ม = ขยับไม่ได้เลย ไม่ใช่ค่าติดลบ */
export function maxTravel(trackWidth: number, knobSize: number, inset: number): number {
  return Math.max(0, trackWidth - knobSize - inset * 2);
}

/** หัวปุ่มอยู่ตรงไหน ลากเลยรางไปก็ค้างที่ปลาย ไม่หลุดออกนอกกรอบ */
export function clampDrag(dx: number, maxX: number): number {
  return Math.min(Math.max(0, dx), maxX);
}

/** ปล่อยนิ้วตรงนี้แล้วนับว่ายืนยันไหม */
export function shouldCommit(dx: number, maxX: number): boolean {
  if (maxX <= 0) return false;
  return clampDrag(dx, maxX) >= maxX * COMMIT_RATIO;
}
