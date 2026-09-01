import type { Order, Restaurant } from '../data/types';
import { isActiveStatus } from '../data/orderStateMachine';

/** กฎกันผลประโยชน์ทับซ้อนตาม product-spec §4 */

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

/** ลูกค้าสั่งเงินสดไว้ แต่พอถึงเวลาแล้วเงินสดไม่พอ เปลี่ยนมาสแกนพร้อมเพย์ได้ไหม */
export function canPayNowWithPromptPay(order: Order): boolean {
  if (order.paymentMethod !== 'cash') return false;
  if (order.paymentStatus !== 'pending') return false;
  return isActiveStatus(order.status);
}

/** ลูกค้ายกเลิกออเดอร์เองได้ไหม (design C27) */
export function canCancelOrder(order: Order): boolean {
  return order.status === 'created' || order.status === 'accepted' || order.status === 'preparing';
}

/** ยกเลิกแล้วต้องคืนเงินไหม */
export function refundDueOnCancel(order: Order): number {
  if (order.paymentStatus !== 'paid') return 0;
  return order.foodTotal + order.deliveryFee + order.serviceFee;
}
