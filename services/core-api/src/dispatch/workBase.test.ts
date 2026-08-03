import { describe, it, expect } from 'vitest';
import { isWithinWorkBase, DEFAULT_WORK_RADIUS_KM } from './scoring';
import { MAX_DELIVERY_RADIUS_KM } from '../orders/deliveryRadius';

describe('จุดตั้งทำงานของไรเดอร์ (R7)', () => {
  it('ร้านในรัศมีที่ตั้งไว้ ผ่าน', () => {
    expect(isWithinWorkBase({ distanceFromBaseKm: 1.8, radiusKm: 2 })).toBe(true);
  });

  /** นี่คือจุดที่ทำให้จอ R7 มีผลจริง ไม่ใช่จอที่ตั้งค่าแล้วไม่เกิดอะไร */
  it('ร้านนอกรัศมี ไม่ถูกเสนอ', () => {
    expect(isWithinWorkBase({ distanceFromBaseKm: 4, radiusKm: 2 })).toBe(false);
  });

  it('พอดีขอบรัศมี ถือว่าอยู่ใน ไม่พลาดเพราะปัดเศษ', () => {
    expect(isWithinWorkBase({ distanceFromBaseKm: 2, radiusKm: 2 })).toBe(true);
  });

  it('ระยะที่คำนวณไม่ได้ ถือว่าไม่ผ่าน ไม่ใช่ปล่อยผ่าน', () => {
    expect(isWithinWorkBase({ distanceFromBaseKm: Number.NaN, radiusKm: 5 })).toBe(false);
    expect(isWithinWorkBase({ distanceFromBaseKm: -1, radiusKm: 5 })).toBe(false);
  });

  /** ค่าเริ่มต้นต้องไม่แคบกว่าระยะที่ลูกค้าสั่งได้ */
  it('รัศมีเริ่มต้นเท่ากับระยะส่งสูงสุดที่ลูกค้าสั่งได้', () => {
    expect(DEFAULT_WORK_RADIUS_KM).toBe(MAX_DELIVERY_RADIUS_KM);
  });
});
