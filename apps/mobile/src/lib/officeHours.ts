/** เวลาทำการของทีมซัพพอร์ต ต้องตรงกับ `support/officeHours.ts` ฝั่งเซิร์ฟเวอร์ */
export const BANGKOK_UTC_OFFSET_MINUTES = 7 * 60;
export const OFFICE_OPEN_HOUR = 9;
export const OFFICE_CLOSE_HOUR = 21;

export function isOutsideOfficeHours(at: Date): boolean {
  const shifted = new Date(at.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000);
  const hour = shifted.getUTCHours();
  return hour < OFFICE_OPEN_HOUR || hour >= OFFICE_CLOSE_HOUR;
}

export function nextOpenAt(at: Date): Date {
  const shifted = new Date(at.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000);
  if (shifted.getUTCHours() >= OFFICE_CLOSE_HOUR) shifted.setUTCDate(shifted.getUTCDate() + 1);
  shifted.setUTCHours(OFFICE_OPEN_HOUR, 0, 0, 0);
  return new Date(shifted.getTime() - BANGKOK_UTC_OFFSET_MINUTES * 60_000);
}
