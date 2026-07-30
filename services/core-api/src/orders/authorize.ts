import { ForbiddenException } from '@nestjs/common';
import type { OrderStatus } from './stateMachine';

/** ความสัมพันธ์ระหว่างคนที่ยิง request กับออร์เดอร์ใบนั้น */
export type Actor = 'customer' | 'restaurantOwner' | 'rider' | 'admin' | 'stranger';

/**
 * ใครเปลี่ยนสถานะเป็นอะไรได้ — **ฟังก์ชันบริสุทธิ์ ทดสอบได้ครบทุกช่องโดยไม่ต้องมีฐาน**
 *
 * ต้องมีเพราะการเปลี่ยนสถานะเป็น `delivered` **เขียน ledger จริง** (claude.md §6.2)
 * ถ้าใครก็กดได้ คนหนึ่งจะสร้างรายการบัญชีของออร์เดอร์คนอื่นได้ = ปัญหาการเงิน ไม่ใช่บั๊ก
 *
 * เหตุผลของแต่ละช่อง:
 * - **ร้าน** รับออร์เดอร์และบอกว่าทำอาหารอยู่ (คิวออร์เดอร์ของร้าน) และปฏิเสธได้
 * - **ไรเดอร์ที่รับงานแล้ว** เท่านั้นที่บอกได้ว่ารับของแล้วและส่งถึงแล้ว
 *   ไรเดอร์คนอื่นกดไม่ได้ ไม่งั้นแย่งกันปิดงานได้
 * - **ลูกค้า** ยกเลิกได้เท่านั้น และรัฐเครื่องจักรสถานะจำกัดอยู่แล้วว่ายกเลิกได้ถึงแค่ก่อนรับของ
 *   ลูกค้ากด delivered เองไม่ได้ ไม่งั้นสร้างรายการบัญชีปลอมได้
 * - **แอดมิน** ทำได้ทุกอย่าง เพราะ §6.3 กำหนดให้มีทางแทรกมือเมื่อระบบจ่ายงานพลาด
 */
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
    // ไม่บอกว่า "คุณเป็นแค่ลูกค้า" — บอกแค่ว่าทำไม่ได้ ไม่ต้องอธิบายโครงสิทธิ์ให้คนยิง
    throw new ForbiddenException({ message: 'บัญชีนี้เปลี่ยนสถานะออร์เดอร์เป็นค่านี้ไม่ได้' });
  }
}
