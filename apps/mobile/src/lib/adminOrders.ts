import type { AdminOrderFilter, AdminOrderRow, OrderStatus } from '../data/types';
import { isActiveStatus } from '../data/orderStateMachine';

/** นิยาม "ช้า" กับ "ไม่มีไรเดอร์" ของจอ AD2 */
export const DELAYED_AFTER_MINUTES = 30;

export function isDelayed(row: { status: OrderStatus; minutesElapsed: number }): boolean {
  return isActiveStatus(row.status) && row.minutesElapsed > DELAYED_AFTER_MINUTES;
}

export function isUnassigned(row: { status: OrderStatus; riderName: string | null }): boolean {
  return isActiveStatus(row.status) && row.riderName === null;
}

export function matchesFilter(filter: AdminOrderFilter, row: AdminOrderRow): boolean {
  if (filter === 'delayed') return isDelayed(row);
  if (filter === 'unassigned') return isUnassigned(row);
  return true;
}
