/** ระยะส่งสูงสุดต่อหนึ่งออร์เดอร์ (กิโลเมตร) */
export const MAX_DELIVERY_RADIUS_KM = 5;

export function isWithinDeliveryRadius(distanceKm: number): boolean {
  return Number.isFinite(distanceKm) && distanceKm >= 0 && distanceKm <= MAX_DELIVERY_RADIUS_KM;
}
