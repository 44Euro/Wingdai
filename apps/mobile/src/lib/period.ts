import type { EarningsPeriod } from '../data/types';

/** จุดเริ่มของช่วงที่เลือกบนจอรายได้ (design R6) */
export function periodStart(period: EarningsPeriod, now: Date): Date {
  if (period === 'today') {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    return midnight;
  }
  const days = period === 'week' ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** จำนวนวันที่ช่วงนั้นครอบคลุม ใช้คิด §8 งาน/ชั่วโมง ให้ตรงกับช่วงที่โชว์ */
export function periodDays(period: EarningsPeriod): number {
  return period === 'today' ? 1 : period === 'week' ? 7 : 30;
}
