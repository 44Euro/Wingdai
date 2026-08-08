import { describe, it, expect } from 'vitest';
import { isOutsideOfficeHours, nextOpenAt } from './officeHours';

/** เวลาไทย → UTC (ไทยไม่มี daylight saving) */
const bkk = (iso: string) => new Date(`${iso}+07:00`);

describe('เวลาทำการของทีมซัพพอร์ต', () => {
  it('กลางวันอยู่ในเวลาทำการ', () => {
    for (const h of ['09:00', '12:30', '20:59']) {
      expect(isOutsideOfficeHours(bkk(`2026-08-08T${h}:00`))).toBe(false);
    }
  });

  /** 21:00 ตรงถือว่าปิดแล้ว เพราะคนที่ทักตอนนั้นจะไม่มีใครตอบ */
  it('ก่อนเปิดและตั้งแต่ปิดเป็นต้นไป อยู่นอกเวลาทำการ', () => {
    for (const h of ['00:15', '02:00', '08:59', '21:00', '23:30']) {
      expect(isOutsideOfficeHours(bkk(`2026-08-08T${h}:00`))).toBe(true);
    }
  });

  it('ทักตอนดึกหลังปิด ได้คำตอบเช้าวันถัดไป', () => {
    expect(nextOpenAt(bkk('2026-08-08T22:30:00')).toISOString())
      .toBe(bkk('2026-08-09T09:00:00').toISOString());
  });

  it('ทักตอนตีสอง ได้คำตอบเช้าวันเดียวกัน ไม่ใช่รออีกวัน', () => {
    expect(nextOpenAt(bkk('2026-08-09T02:00:00')).toISOString())
      .toBe(bkk('2026-08-09T09:00:00').toISOString());
  });

  it('รอบเปิดถัดไปอยู่นอกเวลาทำการไม่ได้ — ไม่งั้นบอกเวลาที่ยังไม่มีใครอยู่', () => {
    for (const h of ['00:15', '08:00', '21:30', '23:59']) {
      expect(isOutsideOfficeHours(nextOpenAt(bkk(`2026-08-08T${h}:00`)))).toBe(false);
    }
  });

  it('รอบเปิดถัดไปอยู่หลังเวลาที่ทักเสมอ', () => {
    for (const h of ['00:15', '08:00', '21:30', '23:59']) {
      const at = bkk(`2026-08-08T${h}:00`);
      expect(nextOpenAt(at).getTime()).toBeGreaterThan(at.getTime());
    }
  });
});
