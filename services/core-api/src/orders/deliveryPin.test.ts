import { describe, it, expect } from 'vitest';
import { generateDeliveryPin, assertPinMatches, DELIVERY_PIN_LENGTH } from './deliveryPin';

describe('PIN ยืนยันส่ง', () => {
  it('เป็นตัวเลขสี่หลักเสมอ', () => {
    for (let i = 0; i < 2000; i++) {
      expect(generateDeliveryPin()).toMatch(/^\d{4}$/);
    }
  });

  it('ความยาวตรงกับจำนวนช่องบนจอ', () => {
    expect(DELIVERY_PIN_LENGTH).toBe(4);
    expect(generateDeliveryPin()).toHaveLength(DELIVERY_PIN_LENGTH);
  });

  /** ถ้าเผลอใช้ String(n) โดยไม่ padStart จะไม่มีอันไหนขึ้นต้นด้วย 0 เลย */
  it('สร้าง PIN ที่มีศูนย์นำหน้าได้ ไม่ตัดทิ้ง', () => {
    const pins = new Set<string>();
    for (let i = 0; i < 20_000; i++) pins.add(generateDeliveryPin());
    expect([...pins].some((p) => p.startsWith('0'))).toBe(true);
  });

  it('กระจายทั่วช่วง 0000–9999 ไม่กระจุกอยู่ช่วงเดียว', () => {
    const pins = new Set<string>();
    for (let i = 0; i < 20_000; i++) pins.add(generateDeliveryPin());
    // สุ่มสองหมื่นครั้งจากหมื่นค่า ต้องเจอค่าที่ต่างกันเกินครึ่งของช่วง
    expect(pins.size).toBeGreaterThan(5_000);
  });

  it('PIN ตรงผ่าน PIN ผิดโยน error', () => {
    expect(() => assertPinMatches('0481', '0481')).not.toThrow();
    expect(() => assertPinMatches('0481', '1840')).toThrow();
  });

  it('เทียบแบบเป๊ะ ไม่ตัดช่องว่างหรือแปลงชนิดให้', () => {
    expect(() => assertPinMatches('0481', ' 0481')).toThrow();
    expect(() => assertPinMatches('0481', '481')).toThrow();
    expect(() => assertPinMatches('0481', '')).toThrow();
  });
});
