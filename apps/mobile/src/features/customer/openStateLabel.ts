import { BANGKOK_UTC_OFFSET_MINUTES } from '../../lib/officeHours';

/** ป้ายบอกว่าร้านปิดอยู่ และเปิดอีกทีเมื่อไหร่ (design C28) */
export function openStateLabel(
  restaurant: { isOpen: boolean; opensAt: string | null },
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (restaurant.isOpen) return null;
  if (!restaurant.opensAt) return t('customer.home.closed');

  const at = new Date(restaurant.opensAt);
  if (Number.isNaN(at.getTime())) return t('customer.home.closed');

  return t('customer.home.opensAt', { time: bangkokClock(at) });
}

/** เวลาไทยในรูป HH:MM ไม่ใช้ `toLocaleTimeString` เพราะเครื่องจำลองกับเครื่องจริง */
function bangkokClock(at: Date): string {
  const shifted = new Date(at.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
