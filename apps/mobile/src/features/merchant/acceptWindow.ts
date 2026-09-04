/** หน้าต่างเวลาที่ร้าน "ควร" กดรับออเดอร์ (design M2/M3 จอนับถอยหลัง) */
export const ACCEPT_WINDOW_SECONDS = 60;

/** เหลือกี่วินาที บีบให้อยู่ในช่วง 0 ถึง ACCEPT_WINDOW_SECONDS เสมอ */
export function secondsLeftToAccept(createdAt: string, now: number): number {
  const elapsed = (now - new Date(createdAt).getTime()) / 1000;
  const left = Math.ceil(ACCEPT_WINDOW_SECONDS - elapsed);
  return Math.min(ACCEPT_WINDOW_SECONDS, Math.max(0, left));
}

export type AcceptUrgency = 'calm' | 'urgent' | 'late';

/** ระดับความเร่ง ใช้เลือกสีและข้อความ ไม่ได้ใช้ตัดสินใจอะไรที่มีผลกับเงิน */
export function acceptUrgency(secondsLeft: number): AcceptUrgency {
  if (secondsLeft === 0) return 'late';
  return secondsLeft <= 15 ? 'urgent' : 'calm';
}
