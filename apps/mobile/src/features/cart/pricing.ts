import type { PricingConfig } from '../../data/types';

/**
 * ค่าสำรอง ใช้ได้เฉพาะโหมดข้อมูลจำลองและช่วงก่อน `GET /config` มาถึง
 *
 * §6.5 สั่งว่าสูตรสองฝั่งต้องเหมือนกัน สูตรตรงกันมาตลอด ที่เคยหลุดคือค่าที่ป้อนเข้าสูตร —
 * แอปฝังตัวเลขไว้ ส่วนเซิร์ฟเวอร์อ่านจาก `platform_pricing` พอ SA6 แก้ราคา ตะกร้าจึงโชว์เลขเก่า
 * ฟังก์ชันข้างล่างจึงบังคับให้ผู้เรียกส่งราคาเข้ามา ลืมไม่ได้
 */
export const FALLBACK_PRICING: PricingConfig = {
  deliveryBaseSatang: 1500,
  deliveryPerKmSatang: 600,
  serviceFeeSatang: 500,
};

/** ค่าส่งตามระยะ (design SA6) คู่แฝดของ `deliveryFeeOf` ฝั่งเซิร์ฟเวอร์ */
export function deliveryFeeOf(distanceKm: number | null, pricing: PricingConfig): number {
  const { deliveryBaseSatang, deliveryPerKmSatang } = pricing;
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0) {
    return deliveryBaseSatang;
  }
  return deliveryBaseSatang + Math.max(0, Math.ceil(distanceKm) - 1) * deliveryPerKmSatang;
}

export function orderTotals(foodTotal: number, distanceKm: number | null, pricing: PricingConfig) {
  const deliveryFee = deliveryFeeOf(distanceKm, pricing);
  return {
    foodTotal,
    deliveryFee,
    serviceFee: pricing.serviceFeeSatang,
    grandTotal: foodTotal + deliveryFee + pricing.serviceFeeSatang,
  };
}

/** ชื่อรายการสำหรับออเดอร์ ต่อท้ายตัวเลือกที่เลือกในวงเล็บ ให้ร้านเห็น */
export function orderItemName(name: string, selectedChoices: { name: string }[]): string {
  return selectedChoices.length ? `${name} (${selectedChoices.map((c) => c.name).join(', ')})` : name;
}
