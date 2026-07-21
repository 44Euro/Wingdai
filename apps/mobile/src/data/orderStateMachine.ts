import type { OrderStatus } from './types';

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`เปลี่ยนสถานะออร์เดอร์จาก "${from}" ไป "${to}" ไม่ได้`);
    this.name = 'InvalidTransitionError';
  }
}

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  created: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['picked_up', 'cancelled'],
  picked_up: ['delivered'], // เลยจุดนี้ยกเลิกไม่ได้ ต้องใช้กระบวนการคืนเงินแทน
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
