import { describe, it, expect } from 'vitest';
import {
  priceOrder,
  orderReference,
  paymentFeeOf,
  DEFAULT_DELIVERY_BASE_SATANG,
  SERVICE_FEE_SATANG,
  type PricedItem,
} from './pricing';

/** ระยะที่ใช้ในเทสต์ชุดนี้เป็น 1 กม. เสมอ เพื่อให้ค่าส่งเท่ากับค่าตั้งต้นพอดี */
const ONE_KM = 1;

const item = (over: Partial<PricedItem> = {}): PricedItem => ({
  menuItemId: 'm1',
  name: 'ข้าวกะเพรา',
  unitPriceSatang: 5000,
  quantity: 1,
  selectedChoices: [],
  ...over,
});

describe('การคิดยอดออร์เดอร์', () => {
  it('ค่าอาหารคิดจากราคาต่อหน่วยคูณจำนวน', () => {
    const p = priceOrder([item({ quantity: 2 }), item({ unitPriceSatang: 2500 })], ONE_KM);
    expect(p.foodTotalSatang).toBe(12500);
  });

  it('ค่าส่งกับค่าบริการเป็นบรรทัดแยก ไม่ยุบเข้าค่าอาหาร (product-spec §3 ข้อ 2)', () => {
    const p = priceOrder([item()], ONE_KM);
    expect(p.foodTotalSatang).toBe(5000);
    expect(p.deliveryFeeSatang).toBe(DEFAULT_DELIVERY_BASE_SATANG);
    expect(p.serviceFeeSatang).toBe(SERVICE_FEE_SATANG);
    expect(p.grandTotalSatang).toBe(5000 + DEFAULT_DELIVERY_BASE_SATANG + SERVICE_FEE_SATANG);
  });

  /** §6.1 ตัวเลขนี้คือฐานของคำสัญญา "ราคาเท่าหน้าร้าน" ห้ามเพี้ยน */
  it('คอมมิชชันเป็น 15% ของค่าอาหารเท่านั้น ไม่คิดจากค่าส่ง/ค่าบริการ', () => {
    const p = priceOrder([item({ unitPriceSatang: 15000 })], ONE_KM);
    expect(p.foodTotalSatang).toBe(15000);
    expect(p.commissionSatang).toBe(2250);
    // ถ้าเผลอคิดจากยอดรวมจะได้ 2550 ต่างกัน ฿3 ต่อออร์เดอร์ ซึ่งบานได้เร็วมาก
    expect(p.commissionSatang).not.toBe(2550);
  });

  it('ยอดทุกช่องเป็นจำนวนเต็มสตางค์เสมอ', () => {
    // 3 ชิ้น ราคา 3,333 สตางค์ → คอมมิชชันมีเศษ ต้องปัดลงเป็นจำนวนเต็ม
    const p = priceOrder([item({ unitPriceSatang: 3333, quantity: 3 })], ONE_KM);
    for (const [k, v] of Object.entries(p)) {
      expect(Number.isInteger(v), `${k} = ${v}`).toBe(true);
    }
  });

  it('ตัวเลือกที่เลือกถูกบวกในราคาต่อหน่วยมาก่อนแล้ว ไม่บวกซ้ำ', () => {
    // ราคาต่อหน่วย 6500 = ข้าว 5000 + ไข่ดาว 1500 (ผู้เรียกบวกมาแล้ว)
    const p = priceOrder([
      item({ unitPriceSatang: 6500, selectedChoices: [{ id: 'c1', name: 'ไข่ดาว', priceDelta: 1500 }] }),
    ], ONE_KM);
    expect(p.foodTotalSatang).toBe(6500);
  });
});

describe('ค่าธรรมเนียมเกตเวย์', () => {
  it('เงินสดไม่มีค่าธรรมเนียมเสมอ', () => {
    expect(paymentFeeOf('cash', 17000)).toBe(0);
  });

  /** ยังเป็น 0 เพราะยังไม่ได้เลือกเกตเวย์ (§11 ข้อ 3) และ QR เป็นของปลอม จึงยังไม่เสียเงินจริง */
  it('พร้อมเพย์ยังเป็น 0 จนกว่าจะเลือกเกตเวย์ได้', () => {
    expect(paymentFeeOf('promptpay', 17000)).toBe(0);
  });

  it('ค่าธรรมเนียมเป็นจำนวนเต็มสตางค์ ปัดลง', () => {
    expect(Number.isInteger(paymentFeeOf('card', 17777))).toBe(true);
  });
});

describe('เลขที่ออร์เดอร์', () => {
  it('ขึ้นต้น WD- และยาว 9 ตัว', () => {
    expect(orderReference()).toMatch(/^WD-[23456789A-HJ-NP-Z]{6}$/);
  });

  /** ตัวที่คนอ่านผิดบ่อยตอนแจ้งปัญหาทางโทรศัพท์ ตัดออกตั้งแต่ชุดอักษร */
  it('ไม่มีตัวที่สับสนกันได้ (0 O 1 I l)', () => {
    // สุ่มให้ไปตกที่ทุกตำแหน่งของชุดอักษร แล้วเช็คว่าไม่มีตัวห้าม
    for (let i = 0; i < 32; i += 1) {
      const ref = orderReference(() => i / 32);
      expect(ref).not.toMatch(/[01OIl]/);
    }
  });
});
