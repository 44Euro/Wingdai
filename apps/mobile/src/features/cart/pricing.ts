/** ค่าธรรมเนียมฝั่งแอป การแสดงผลล่วงหน้าเท่านั้น */
export const DELIVERY_BASE_SATANG = 1500; // ฿15 สำหรับระยะไม่เกิน 1 กม.
export const DELIVERY_PER_KM_SATANG = 600; // ฿6 ต่อกิโลเมตรถัดไป
export const SERVICE_FEE = 500; // ฿5

/** ค่าส่งตามระยะ (design SA6) คู่แฝดของ `deliveryFeeOf` ฝั่งเซิร์ฟเวอร์ */
export function deliveryFeeOf(
  distanceKm: number | null,
  baseSatang = DELIVERY_BASE_SATANG,
  perKmSatang = DELIVERY_PER_KM_SATANG,
): number {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0) return baseSatang;
  return baseSatang + Math.max(0, Math.ceil(distanceKm) - 1) * perKmSatang;
}

export function orderTotals(foodTotal: number, distanceKm: number | null) {
  const deliveryFee = deliveryFeeOf(distanceKm);
  return {
    foodTotal,
    deliveryFee,
    serviceFee: SERVICE_FEE,
    grandTotal: foodTotal + deliveryFee + SERVICE_FEE,
  };
}

/** ชื่อรายการสำหรับออร์เดอร์ ต่อท้ายตัวเลือกที่เลือกในวงเล็บ ให้ร้านเห็น */
export function orderItemName(name: string, selectedChoices: { name: string }[]): string {
  return selectedChoices.length ? `${name} (${selectedChoices.map((c) => c.name).join(', ')})` : name;
}
