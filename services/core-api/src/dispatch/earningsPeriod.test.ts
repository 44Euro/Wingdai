import { describe, it, expect } from 'vitest';
import { periodStart, periodDays, EARNINGS_PERIODS } from './earningsPeriod';

/** "วันนี้" ของไรเดอร์คือวันตามเวลาไทย ไม่ใช่ตามเวลาเซิร์ฟเวอร์ */
describe('periodStart', () => {
  it('วันนี้เริ่มที่เที่ยงคืนเวลาไทย', () => {
    // 2026-08-04 14:30 ไทย
    const now = new Date('2026-08-04T07:30:00Z');
    expect(periodStart('today', now).toISOString()).toBe('2026-08-03T17:00:00.000Z');
  });

  /** ตี 1 ครึ่งเวลาไทย = 18:30 UTC ของ *เมื่อวาน* ถ้าคิดเป็นเที่ยงคืน UTC */
  it('ตีหนึ่งครึ่งเวลาไทยยังนับเป็นวันเดียวกัน', () => {
    const now = new Date('2026-08-03T18:30:00Z');
    const start = periodStart('today', now);
    expect(start.toISOString()).toBe('2026-08-03T17:00:00.000Z');
    expect(start.getTime()).toBeLessThan(now.getTime());
  });

  it('จุดเริ่มไม่เคยอยู่หลังเวลาปัจจุบัน', () => {
    for (let h = 0; h < 24; h += 1) {
      const now = new Date(Date.UTC(2026, 7, 4, h, 0, 0));
      for (const p of EARNINGS_PERIODS) {
        expect(periodStart(p, now).getTime()).toBeLessThanOrEqual(now.getTime());
      }
    }
  });

  it('สัปดาห์กับเดือนเป็นช่วงย้อนหลัง 7 และ 30 วัน', () => {
    const now = new Date('2026-08-04T07:30:00Z');
    const day = 24 * 60 * 60 * 1000;
    expect(now.getTime() - periodStart('week', now).getTime()).toBe(7 * day);
    expect(now.getTime() - periodStart('month', now).getTime()).toBe(30 * day);
  });

  it('ช่วงยิ่งยาวยิ่งเริ่มก่อน', () => {
    const now = new Date('2026-08-04T07:30:00Z');
    expect(periodStart('month', now).getTime()).toBeLessThan(periodStart('week', now).getTime());
    expect(periodStart('week', now).getTime()).toBeLessThan(periodStart('today', now).getTime());
  });

  it('periodDays ตรงกับช่วงที่ใช้จริง', () => {
    expect(periodDays('today')).toBe(1);
    expect(periodDays('week')).toBe(7);
    expect(periodDays('month')).toBe(30);
  });
});
