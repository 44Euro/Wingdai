export const DELIVERY_FEE = 1500; // ฿15 สตางค์ (mock คงที่ slice นี้)
export const SERVICE_FEE = 500; // ฿5

export function orderTotals(foodTotal: number) {
  return {
    foodTotal,
    deliveryFee: DELIVERY_FEE,
    serviceFee: SERVICE_FEE,
    grandTotal: foodTotal + DELIVERY_FEE + SERVICE_FEE,
  };
}

/** ชื่อรายการสำหรับออร์เดอร์ — ต่อท้ายตัวเลือกที่เลือกในวงเล็บ ให้ร้านเห็น */
export function orderItemName(name: string, selectedChoices: { name: string }[]): string {
  return selectedChoices.length ? `${name} (${selectedChoices.map((c) => c.name).join(', ')})` : name;
}
