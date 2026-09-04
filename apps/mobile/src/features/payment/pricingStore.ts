import { create } from 'zustand';
import type { PricingConfig } from '../../data/types';
import { FALLBACK_PRICING } from '../cart/pricing';

/**
 * ค่าธรรมเนียมที่ทุกจอใช้คิดราคาล่วงหน้า มาจาก `GET /config` ที่เดียว
 *
 * §6.5 ตะกร้ากับเซิร์ฟเวอร์ต้องได้เลขเดียวกัน การให้แต่ละจอหยิบค่าคงที่เองคือทางที่มันหลุด
 * ตอนซูเปอร์แอดมินแก้ราคาใน SA6
 */
type PricingState = {
  pricing: PricingConfig;
  setPricing: (next: PricingConfig) => void;
};

export const usePricingStore = create<PricingState>((set) => ({
  pricing: FALLBACK_PRICING,
  setPricing: (next) => set({ pricing: next }),
}));

export function usePricing(): PricingConfig {
  return usePricingStore((s) => s.pricing);
}
