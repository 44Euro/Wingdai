import { commissionOf, DEFAULT_COMMISSION_RATE_BP } from '../db/schema/money';

/** ค่าตั้งต้นของค่าธรรมเนียม ค่าจริงมาจากตาราง `platform_pricing` (design SA6) */
export const DEFAULT_DELIVERY_BASE_SATANG = 1500;
export const DEFAULT_DELIVERY_PER_KM_SATANG = 600;
export const SERVICE_FEE_SATANG = 500;

/** ค่าส่งตามระยะ (design SA6 "Base fare ฿10 Per km after 1 km ฿6") */
export function deliveryFeeOf(
  distanceKm: number,
  baseSatang: number,
  perKmSatang: number,
): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error(`ระยะทางต้องเป็นตัวเลขที่ไม่ติดลบ ได้ ${distanceKm}`);
  }
  const extraKm = Math.max(0, Math.ceil(distanceKm) - 1);
  return baseSatang + extraKm * perKmSatang;
}

/** ราคาที่ใช้จริงตอนสร้างออร์เดอร์ service อ่านจากฐานแล้วส่งเข้ามา */
export type PricingConfig = {
  commissionRateBp: number;
  deliveryBaseSatang: number;
  deliveryPerKmSatang: number;
  serviceFeeSatang: number;
};

export const DEFAULT_PRICING: PricingConfig = {
  commissionRateBp: DEFAULT_COMMISSION_RATE_BP,
  deliveryBaseSatang: DEFAULT_DELIVERY_BASE_SATANG,
  deliveryPerKmSatang: DEFAULT_DELIVERY_PER_KM_SATANG,
  serviceFeeSatang: SERVICE_FEE_SATANG,
};

/** ค่าธรรมเนียมเกตเวย์ต่อหนึ่งหมื่น (basis point) */
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
  /** ข้อความฝากถึงร้านสำหรับจานนี้ ไม่มีผลกับราคา ติดมากับรายการเพื่อบันทึกพร้อมกัน */
  note?: string;
};

export type OrderPricing = {
  foodTotalSatang: number;
  deliveryFeeSatang: number;
  serviceFeeSatang: number;
  commissionSatang: number;
  grandTotalSatang: number;
};

/** คิดยอดจากรายการที่ตีราคาแล้ว ฟังก์ชันบริสุทธิ์ ทดสอบได้โดยไม่ต้องมีฐาน */
export function priceOrder(
  items: PricedItem[],
  distanceKm: number,
  config: PricingConfig = DEFAULT_PRICING,
): OrderPricing {
  const foodTotalSatang = items.reduce((sum, i) => sum + i.unitPriceSatang * i.quantity, 0);

  for (const [key, value] of Object.entries({ foodTotalSatang })) {
    if (!Number.isInteger(value)) throw new Error(`${key} ต้องเป็นจำนวนเต็มสตางค์ ได้ ${value}`);
  }

  const deliveryFeeSatang = deliveryFeeOf(
    distanceKm,
    config.deliveryBaseSatang,
    config.deliveryPerKmSatang,
  );

  return {
    foodTotalSatang,
    deliveryFeeSatang,
    serviceFeeSatang: config.serviceFeeSatang,
    // §6.1 คิดจากค่าอาหารเท่านั้น ไม่รวมค่าส่งและค่าบริการ
    commissionSatang: commissionOf(foodTotalSatang, config.commissionRateBp),
    grandTotalSatang: foodTotalSatang + deliveryFeeSatang + config.serviceFeeSatang,
  };
}

export function paymentFeeOf(method: keyof typeof PAYMENT_FEE_BP, grossSatang: number): number {
  return Math.floor((grossSatang * PAYMENT_FEE_BP[method]) / 10000);
}

/** เลขที่ออร์เดอร์ที่ลูกค้าอ่านออก สั้น ไม่มีตัวอักษรที่สับสนกับเลข (I, O, l, 0, 1) */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function orderReference(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `WD-${out}`;
}
