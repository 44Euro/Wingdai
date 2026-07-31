/** เวลาที่เหลือให้ไรเดอร์ตอบรับงาน (product-spec §6.3 15 วินาที) */
export const RESPOND_WINDOW_SECONDS = 15;

export function secondsLeftToRespond(expiresAt: string, now: number): number {
  const left = Math.ceil((new Date(expiresAt).getTime() - now) / 1000);
  return Math.min(RESPOND_WINDOW_SECONDS, Math.max(0, left));
}
