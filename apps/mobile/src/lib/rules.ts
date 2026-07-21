import type { Order, Restaurant } from '../data/types';

/**
 * กฎกันผลประโยชน์ทับซ้อนตาม claude.md §4
 * รวมไว้ที่ไฟล์เดียวเพื่อให้ย้ายไปฝั่งเซิร์ฟเวอร์ได้โดยไม่ต้องไล่หา
 * ในรอบนี้บังคับที่ฝั่งแอปเพราะยังไม่มีเซิร์ฟเวอร์ — ของจริงต้องเช็คซ้ำที่เซิร์ฟเวอร์
 */

export function canOrderFromRestaurant(accountId: string, restaurant: Restaurant): boolean {
  if (restaurant.ownerUserId === accountId) return false;
  if (!restaurant.isApproved) return false;
  if (!restaurant.isOpen) return false;
  return true;
}

export function canRiderAcceptOrder(riderId: string, order: Order): boolean {
  if (order.customerId === riderId) return false;
  if (order.riderId) return false;
  return true;
}
