import { describe, it, expect } from 'vitest';
import { deliveryFeeOf, DEFAULT_DELIVERY_BASE_SATANG, DEFAULT_DELIVERY_PER_KM_SATANG } from './pricing';

const base = DEFAULT_DELIVERY_BASE_SATANG;
const perKm = DEFAULT_DELIVERY_PER_KM_SATANG;

describe('deliveryFeeOf — ค่าส่งตามระยะ (design SA6)', () => {
  /** กิโลแรกรวมอยู่ในค่าตั้งต้นแล้ว ระยะ 0.4 กับ 1.0 กม. จึงเท่ากัน */
  it('ระยะไม่เกิน 1 กม. จ่ายแค่ค่าตั้งต้น', () => {
    expect(deliveryFeeOf(0, base, perKm)).toBe(base);
    expect(deliveryFeeOf(0.4, base, perKm)).toBe(base);
    expect(deliveryFeeOf(1, base, perKm)).toBe(base);
  });

  it('เกิน 1 กม. คิดเพิ่มเป็นกิโล ปัดขึ้น', () => {
    // 1.1 กม. → ปัดเป็น 2 กม. → คิดเพิ่ม 1 ช่วง
    expect(deliveryFeeOf(1.1, base, perKm)).toBe(base + perKm);
    expect(deliveryFeeOf(2, base, perKm)).toBe(base + perKm);
    expect(deliveryFeeOf(2.1, base, perKm)).toBe(base + 2 * perKm);
  });

  /** §1 §7 เกิน 5 กม. สั่งไม่ได้อยู่แล้ว แต่สูตรต้องไม่พังถ้ามีใครเรียกด้วยค่านั้น */
  it('ระยะสูงสุดที่ระบบยอมรับยังคิดได้', () => {
    expect(deliveryFeeOf(5, base, perKm)).toBe(base + 4 * perKm);
  });

  it('ค่าตั้งต้นให้ผลเท่ากับค่าส่งคงที่เดิมที่ระยะสั้น (฿15)', () => {
    expect(deliveryFeeOf(1, base, perKm)).toBe(1500);
  });

  /** §5 กติกาข้อ 1 เงินทุกค่าต้องเป็นจำนวนเต็มสตางค์ ไม่มีข้อยกเว้น */
  it('ผลลัพธ์เป็นจำนวนเต็มเสมอ ทุกระยะ', () => {
    for (let km = 0; km <= 5; km += 0.13) {
      expect(Number.isInteger(deliveryFeeOf(km, base, perKm))).toBe(true);
    }
  });

  it('ระยะติดลบหรือไม่ใช่ตัวเลข ถูกปฏิเสธ ไม่ใช่คิดเป็นค่าติดลบ', () => {
    expect(() => deliveryFeeOf(-1, base, perKm)).toThrow();
    expect(() => deliveryFeeOf(Number.NaN, base, perKm)).toThrow();
  });

  /** ค่าที่ตั้งจาก SA6 ต้องมีผลจริง ไม่ใช่รับมาแล้วใช้ค่าคงที่เดิม */
  it('เปลี่ยนอัตราแล้วผลเปลี่ยนตาม', () => {
    expect(deliveryFeeOf(3, 2000, 1000)).toBe(2000 + 2 * 1000);
  });
});
