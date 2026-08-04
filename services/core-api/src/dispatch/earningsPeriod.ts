/** ช่วงเวลาของจอรายได้ (design R6) */
export type EarningsPeriod = 'today' | 'week' | 'month';

export const EARNINGS_PERIODS: EarningsPeriod[] = ['today', 'week', 'month'];

/** จุดเริ่มของช่วง */
export function periodStart(period: EarningsPeriod, now: Date): Date {
  if (period === 'today') {
    const bangkokOffsetMs = 7 * 60 * 60 * 1000;
    const local = new Date(now.getTime() + bangkokOffsetMs);
    const midnightLocal = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
    );
    return new Date(midnightLocal - bangkokOffsetMs);
  }
  const days = period === 'week' ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** จำนวนวันที่ช่วงครอบคลุม ใช้คิด §8 งาน/ชั่วโมง ให้ตรงกับช่วงที่โชว์ */
export function periodDays(period: EarningsPeriod): number {
  return period === 'today' ? 1 : period === 'week' ? 7 : 30;
}
