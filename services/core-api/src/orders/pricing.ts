import { commissionOf } from '../db/schema/money';

/**
 * ค่าธรรมเนียมที่เก็บจากลูกค้า — คงที่ทั้งโซนในเฟส 1
 * ต้องตรงกับ apps/mobile/src/features/cart/pricing.ts เพราะจอตะกร้าคิดยอดโชว์ล่วงหน้า
 * แต่ **ยอดที่นับจริงคือฝั่งนี้** ฝั่งแอปเป็นแค่การแสดงผล
 */
export const DELIVERY_FEE_SATANG = 1500;
export const SERVICE_FEE_SATANG = 500;

/**
 * ค่าธรรมเนียมเกตเวย์ต่อหนึ่งหมื่น (basis point)
 *
 * ยังเป็น 0 เพราะยังไม่ได้เลือกเกตเวย์ (claude.md §11 ข้อ 3) และ QR ตอนนี้เป็นของปลอม
 * เราจึงยังไม่เสียค่าธรรมเนียมจริง — ใส่ตัวเลขสมมติไว้จะทำให้ ledger ไม่ตรงกับเงินที่เข้าบัญชีจริง
 *
 * **พอเลือกเกตเวย์ได้แล้วต้องกลับมาแก้ตรงนี้** พร้อมพรี่ยมทั้งบัตร (3.2–3.65% = 320–365 bp)
 * และพร้อมเพย์ (0.8–1.8% = 80–180 bp) ไม่งั้นรายงานกำไรจะสูงเกินจริงตาม §6.5
 */
export const PAYMENT_FEE_BP: Record<'promptpay' | 'cash' | 'card', number> = {
  promptpay: 0,
  cash: 0, // เงินสดไม่มีเกตเวย์ จึงเป็น 0 ตลอดไป ไม่ใช่แค่ชั่วคราว
  card: 0,
};

export type PricedItem = {
  menuItemId: string;
  name: string;
  unitPriceSatang: number;
  quantity: number;
  selectedChoices: { id: string; name: string; priceDelta: number }[];
};

export type OrderPricing = {
  foodTotalSatang: number;
  deliveryFeeSatang: number;
  serviceFeeSatang: number;
  commissionSatang: number;
  grandTotalSatang: number;
};

/**
 * คิดยอดจากรายการที่ตีราคาแล้ว — ฟังก์ชันบริสุทธิ์ ทดสอบได้โดยไม่ต้องมีฐาน
 *
 * ราคาต่อหน่วยต้องมาจากเมนูในฐาน **ห้ามรับจากแอป** ไม่งั้นแอปที่ถูกแก้จะสั่งข้าว ฿500
 * ในราคา ฿1 ได้ และค่าคอมมิชชัน 15% (§6.1) ก็จะเพี้ยนตามไปด้วย
 */
export function priceOrder(items: PricedItem[]): OrderPricing {
  const foodTotalSatang = items.reduce((sum, i) => sum + i.unitPriceSatang * i.quantity, 0);

  for (const [key, value] of Object.entries({ foodTotalSatang })) {
    if (!Number.isInteger(value)) throw new Error(`${key} ต้องเป็นจำนวนเต็มสตางค์ ได้ ${value}`);
  }

  return {
    foodTotalSatang,
    deliveryFeeSatang: DELIVERY_FEE_SATANG,
    serviceFeeSatang: SERVICE_FEE_SATANG,
    // §6.1 คิดจากค่าอาหารเท่านั้น ไม่รวมค่าส่งและค่าบริการ
    commissionSatang: commissionOf(foodTotalSatang),
    grandTotalSatang: foodTotalSatang + DELIVERY_FEE_SATANG + SERVICE_FEE_SATANG,
  };
}

export function paymentFeeOf(method: keyof typeof PAYMENT_FEE_BP, grossSatang: number): number {
  return Math.floor((grossSatang * PAYMENT_FEE_BP[method]) / 10000);
}

/** เลขที่ออร์เดอร์ที่ลูกค้าอ่านออก — สั้น ไม่มีตัวอักษรที่สับสนกับเลข (I, O, l, 0, 1) */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function orderReference(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `WD-${out}`;
}
