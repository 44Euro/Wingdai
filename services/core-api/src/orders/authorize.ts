import { ForbiddenException } from '@nestjs/common';
import type { OrderStatus } from './stateMachine';

/** ความสัมพันธ์ระหว่างคนที่ยิง request กับออร์เดอร์ใบนั้น */
export type Actor = 'customer' | 'restaurantOwner' | 'rider' | 'admin' | 'stranger';

/** ใครเปลี่ยนสถานะเป็นอะไรได้ ฟังก์ชันบริสุทธิ์ ทดสอบได้ครบทุกช่องโดยไม่ต้องมีฐาน */
const ALLOWED: Record<Actor, OrderStatus[]> = {
  restaurantOwner: ['accepted', 'preparing', 'cancelled'],
  rider: ['picked_up', 'delivered'],
  customer: ['cancelled'],
  admin: ['accepted', 'preparing', 'picked_up', 'delivered', 'cancelled'],
  stranger: [],
};

export function canSetStatus(actor: Actor, next: OrderStatus): boolean {
  return ALLOWED[actor].includes(next);
}

export function assertCanSetStatus(actor: Actor, next: OrderStatus): void {
  if (!canSetStatus(actor, next)) {
    // ไม่บอกว่า "คุณเป็นแค่ลูกค้า" บอกแค่ว่าทำไม่ได้ ไม่ต้องอธิบายโครงสิทธิ์ให้คนยิง
    throw new ForbiddenException({ message: 'บัญชีนี้เปลี่ยนสถานะออร์เดอร์เป็นค่านี้ไม่ได้' });
  }
}
