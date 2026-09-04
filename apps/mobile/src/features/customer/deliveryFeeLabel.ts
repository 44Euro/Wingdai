import { formatBaht } from '../../lib/format';
import { deliveryFeeOf } from '../cart/pricing';
import type { PricingConfig } from '../../data/types';

/** เท่าที่ฟังก์ชันนี้ต้องใช้จาก `t` ของ i18next รับแคบไว้เพื่อไม่ผูกกับชนิดของไลบรารี */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/** ค่าส่งที่โชว์บนการ์ดร้านและในตะกร้า */
export function deliveryFeeLabel(
  distanceKm: number | null,
  t: Translate,
  pricing: PricingConfig,
): string {
  const amount = formatBaht(deliveryFeeOf(distanceKm, pricing));
  return distanceKm === null ? t('customer.home.deliveryFeeFrom', { amount }) : amount;
}
