/** เวลาทำการของทีมซัพพอร์ต (design AD4) */
export const BANGKOK_UTC_OFFSET_MINUTES = 7 * 60;
export const OFFICE_OPEN_HOUR = 9;
export const OFFICE_CLOSE_HOUR = 21;

/** ชั่วโมงตามเวลาไทย ณ เวลาที่ให้มา */
function bangkokHour(at: Date): number {
  const shifted = new Date(at.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000);
  return shifted.getUTCHours();
}

/** ตอนนี้อยู่นอกเวลาทำการไหม */
export function isOutsideOfficeHours(at: Date): boolean {
  const hour = bangkokHour(at);
  return hour < OFFICE_OPEN_HOUR || hour >= OFFICE_CLOSE_HOUR;
}

/** รอบเปิดถัดไปหลังเวลาที่ให้มา */
export function nextOpenAt(at: Date): Date {
  const shifted = new Date(at.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000);
  const hour = shifted.getUTCHours();

  // ทักหลังปิด = รอถึงเช้าวันถัดไป ทักก่อนเปิด = รอถึงเช้าวันเดียวกัน
  if (hour >= OFFICE_CLOSE_HOUR) shifted.setUTCDate(shifted.getUTCDate() + 1);
  shifted.setUTCHours(OFFICE_OPEN_HOUR, 0, 0, 0);

  return new Date(shifted.getTime() - BANGKOK_UTC_OFFSET_MINUTES * 60_000);
}
