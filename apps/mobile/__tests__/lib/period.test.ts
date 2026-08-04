import { periodStart, periodDays } from '../../src/lib/period';

/** "วันนี้" ต้องหมายถึงตั้งแต่เที่ยงคืน ไม่ใช่ย้อนหลัง 24 ชั่วโมง */
describe('periodStart', () => {
  const now = new Date('2026-08-04T14:30:00+07:00');

  it('วันนี้เริ่มที่เที่ยงคืนของวันเดียวกัน', () => {
    const start = periodStart('today', now);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getDate()).toBe(now.getDate());
    expect(start.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('งานเมื่อคืนตอนสามทุ่มไม่นับเป็นของวันนี้', () => {
    const lastNight = new Date(now);
    lastNight.setDate(now.getDate() - 1);
    lastNight.setHours(21, 0, 0, 0);
    expect(lastNight.getTime()).toBeLessThan(periodStart('today', now).getTime());
  });

  it('สัปดาห์กับเดือนเป็นช่วงย้อนหลัง 7 และ 30 วัน', () => {
    const day = 24 * 60 * 60 * 1000;
    expect(now.getTime() - periodStart('week', now).getTime()).toBe(7 * day);
    expect(now.getTime() - periodStart('month', now).getTime()).toBe(30 * day);
  });

  /** ช่วงยาวกว่าต้องเริ่มก่อนเสมอ ไม่งั้นชิป "เดือน" จะให้ผลน้อยกว่า "สัปดาห์" */
  it('ช่วงยิ่งยาวยิ่งเริ่มก่อน', () => {
    expect(periodStart('month', now).getTime())
      .toBeLessThan(periodStart('week', now).getTime());
    expect(periodStart('week', now).getTime())
      .toBeLessThan(periodStart('today', now).getTime());
  });

  it('periodDays ตรงกับช่วงที่ใช้จริง', () => {
    expect(periodDays('today')).toBe(1);
    expect(periodDays('week')).toBe(7);
    expect(periodDays('month')).toBe(30);
  });
});
