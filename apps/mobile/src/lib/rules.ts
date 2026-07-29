import type { Order, Restaurant } from '../data/types';
import { isActiveStatus } from '../data/orderStateMachine';

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

/**
 * ลูกค้าสั่งเงินสดไว้ แต่พอถึงเวลาแล้วเงินสดไม่พอ — เปลี่ยนมาสแกนพร้อมเพย์ได้ไหม
 *
 * ในชีวิตจริงลูกค้า Grab/LINE MAN แก้ปัญหานี้ด้วยการโอนเข้าบัญชีไรเดอร์ตรง ๆ
 * **เราจะไม่รองรับทางนั้น** เพราะเงินก้อนนั้นเป็นของแพลตฟอร์ม ไม่ใช่ของไรเดอร์:
 *   - ถ้าไรเดอร์ออกเงินค่าอาหารไปก่อน เท่ากับต้องมีทุนติดตัวถึงจะรับงานได้
 *     ซึ่ง claude.md §6.2 ห้ามไว้ตรง ๆ (เป็นเงื่อนไขที่กีดกันคนมาสมัครเป็นไรเดอร์)
 *   - เงินที่โอนเข้าบัญชีส่วนตัวไรเดอร์ไม่เดินผ่าน ledger เลย กระทบยอดกระทบรอบจ่ายเงิน
 *   - ไรเดอร์กลายเป็นผู้รับความเสี่ยงแทนแพลตฟอร์มโดยไม่ได้ตกลงกันไว้
 *
 * ทางที่ถูกคือลูกค้ากดเปลี่ยนเป็นพร้อมเพย์ในแอป เงินเข้าแพลตฟอร์มโดยตรง
 * แล้วหน้าที่เก็บเงินสดของไรเดอร์ก็หายไปทันที
 *
 * เปลี่ยนได้ตราบใดที่ออร์เดอร์ยังไม่จบและยังไม่ได้จ่าย — ส่งถึงแล้วถือว่าเก็บเงินไปแล้ว
 * ถ้ามีปัญหาหลังจากนั้นต้องเข้ากระบวนการคืนเงิน (§6.4) ไม่ใช่มาเปลี่ยนวิธีจ่ายย้อนหลัง
 */
export function canPayNowWithPromptPay(order: Order): boolean {
  if (order.paymentMethod !== 'cash') return false;
  if (order.paymentStatus !== 'pending') return false;
  return isActiveStatus(order.status);
}
