import { BadRequestException } from '@nestjs/common';
import type { orderStatus } from '../db/schema/enums';

export type OrderStatus = (typeof orderStatus.enumValues)[number];

/**
 * **ต้องตรงกับ apps/mobile/src/data/orderStateMachine.ts เป๊ะ**
 *
 * ซ้ำกันสองที่โดยเจตนาในเฟสนี้ — แอปต้องรู้ล่วงหน้าว่าปุ่มไหนกดได้เพื่อไม่ให้ยิงแล้วเด้ง
 * แต่ **ฝั่งนี้เป็นตัวตัดสิน** ฝั่งแอปเป็นแค่การแสดงผล
 * ถ้าจะย้ายไป packages/shared-types ให้ย้ายพร้อมกันทั้งคู่ อย่าปล่อยให้ต่างกัน
 */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  created: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['picked_up', 'cancelled'],
  picked_up: ['delivered'], // เลยจุดนี้ยกเลิกไม่ได้ ต้องใช้กระบวนการคืนเงิน (§6.4)
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException({
      message: `เปลี่ยนสถานะออร์เดอร์จาก "${from}" ไป "${to}" ไม่ได้`,
    });
  }
}

/** ยัง "มีชีวิต" ถ้ายังเปลี่ยนสถานะต่อได้ — ดึงจาก ALLOWED ไม่พิมพ์รายชื่อซ้ำ */
export function isActiveStatus(status: OrderStatus): boolean {
  return ALLOWED[status].length > 0;
}
