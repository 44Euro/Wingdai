import { describe, it, expect } from 'vitest';
import { riderRate } from './riderRate';

describe('ออเดอร์ต่อชั่วโมงของไรเดอร์', () => {
  it('ยังไม่เคยออนไลน์เลยคือยังวัดไม่ได้ ไม่ใช่ศูนย์', () => {
    expect(riderRate(0, 0).ordersPerHour).toBeNull();
  });

  /** เคสที่ api:check จับได้ ออนไลน์แค่ไม่กี่วินาทีแล้วรายงานว่าทำได้ 0 งาน/ชม. */
  it('ออนไลน์สั้นจนปัดแล้วเหลือศูนย์ชั่วโมง ก็ยังวัดไม่ได้', () => {
    const out = riderRate(0.0008, 0);
    expect(out.hours).toBe(0);
    expect(out.ordersPerHour).toBeNull();
  });

  it('มีชั่วโมงพอวัดแล้วคิดอัตราจากชั่วโมงดิบ', () => {
    const out = riderRate(2.5, 8);
    expect(out.hours).toBe(2.5);
    expect(out.ordersPerHour).toBe(3.2);
  });

  it('ออนไลน์แล้วแต่ยังไม่ได้ส่งงานคือศูนย์จริง ๆ ไม่ใช่ยังวัดไม่ได้', () => {
    expect(riderRate(3, 0).ordersPerHour).toBe(0);
  });
});
