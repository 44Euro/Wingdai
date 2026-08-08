import type { Restaurant } from '../../data/types';
import { deliveryFeeOf } from '../cart/pricing';

/** ตัวกรองและการเรียงลำดับผลค้นหา (design C35) */

export type SortKey = 'recommended' | 'nearest' | 'topRated' | 'fastest';
export type PriceTier = 1 | 2 | 3;

export type RestaurantFilters = {
  sort: SortKey;
  /** ค่าส่งสูงสุดที่ยอมจ่าย (สตางค์) `null` = ไม่จำกัด */
  maxDeliveryFeeSatang: number | null;
  /** คะแนนขั้นต่ำ `null` = ไม่กำหนด */
  minRating: number | null;
  /** ระดับราคาที่เลือก ว่าง = ไม่กรอง */
  priceTiers: PriceTier[];
  /** ซ่อนร้านที่ตอนนี้ปิดอยู่ */
  openOnly: boolean;
};

export const DEFAULT_FILTERS: RestaurantFilters = {
  sort: 'recommended',
  maxDeliveryFeeSatang: null,
  minRating: null,
  priceTiers: [],
  openOnly: false,
};

export function isDefaultFilters(f: RestaurantFilters): boolean {
  return (
    f.sort === DEFAULT_FILTERS.sort
    && f.maxDeliveryFeeSatang === null
    && f.minRating === null
    && f.priceTiers.length === 0
    && !f.openOnly
  );
}

/** ระดับราคาของร้านจากราคาเฉลี่ยต่อจาน ต้องส่งราคามาจากภายนอก เพราะ `Restaurant` */
export const PRICE_TIER_BREAKS = [6000, 12000] as const;

export function priceTierOf(averagePriceSatang: number | null): PriceTier | null {
  if (averagePriceSatang === null) return null;
  if (averagePriceSatang <= PRICE_TIER_BREAKS[0]) return 1;
  if (averagePriceSatang <= PRICE_TIER_BREAKS[1]) return 2;
  return 3;
}

export function applyFilters(
  list: Restaurant[],
  filters: RestaurantFilters,
  /** ราคาเฉลี่ยต่อจานของแต่ละร้าน ไม่มีข้อมูล = ไม่ถูกกรองด้วยระดับราคา */
  averagePriceOf: (restaurantId: string) => number | null = () => null,
): Restaurant[] {
  const kept = list.filter((r) => {
    if (filters.openOnly && !r.isOpen) return false;

    if (filters.minRating !== null) {
      // ร้านที่ยังไม่มีใครรีวิวถูกตัดออกเมื่อกำหนดคะแนนขั้นต่ำ "ไม่รู้" ไม่ใช่ "ผ่าน"
      if (r.rating === null || r.rating < filters.minRating) return false;
    }

    if (filters.maxDeliveryFeeSatang !== null) {
      /** ยังไม่รู้ระยะ = ไม่รู้ค่าส่ง จึงไม่ตัดทิ้ง (กติกาเดียวกับที่ §7 ใช้กับรัศมี) */
      if (r.distanceKm !== null) {
        // ใช้ค่าตั้งต้นเดียวกับป้ายค่าส่งบนการ์ดร้าน (`deliveryFeeLabel`) ไม่งั้นตัวกรอง
        const fee = deliveryFeeOf(r.distanceKm);
        if (fee > filters.maxDeliveryFeeSatang) return false;
      }
    }

    if (filters.priceTiers.length > 0) {
      const tier = priceTierOf(averagePriceOf(r.id));
      if (tier !== null && !filters.priceTiers.includes(tier)) return false;
    }

    return true;
  });

  return sortRestaurants(kept, filters.sort);
}

/** เรียงลำดับ `nullish` ไปท้ายเสมอ ไม่ใช่ถูกนับเป็นศูนย์ */
export function sortRestaurants(list: Restaurant[], sort: SortKey): Restaurant[] {
  const copy = [...list];
  switch (sort) {
    case 'nearest':
      return copy.sort(byNumber((r) => r.distanceKm, 'asc'));
    case 'topRated':
      return copy.sort(byNumber((r) => r.rating, 'desc'));
    case 'fastest':
      /** เรียงตามเวลาทำอาหารที่ร้านตั้งไว้ ไม่ใช่ความเร็วของไรเดอร์ */
      return copy.sort(byNumber((r) => r.prepTimeMinutes, 'asc'));
    case 'recommended':
    default:
      /** "แนะนำ" = ร้านที่เปิดอยู่มาก่อน แล้วเรียงตามระยะ */
      return copy.sort((a, b) => {
        if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
        return compareNullable(a.distanceKm, b.distanceKm, 'asc');
      });
  }
}

function byNumber(pick: (r: Restaurant) => number | null, dir: 'asc' | 'desc') {
  return (a: Restaurant, b: Restaurant) => compareNullable(pick(a), pick(b), dir);
}

function compareNullable(a: number | null, b: number | null, dir: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === 'asc' ? a - b : b - a;
}
