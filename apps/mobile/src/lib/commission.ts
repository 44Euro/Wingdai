/** ค่าคอมมิชชัน 15% คิดจากค่าอาหารเท่านั้น (product-spec §6.1) */
export const COMMISSION_RATE_BP = 1500;

export function commissionOf(foodTotalSatang: number): number {
  return Math.floor((foodTotalSatang * COMMISSION_RATE_BP) / 10000);
}
