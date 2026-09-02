import { isActiveStatus, type OrderStatus } from './stateMachine';

/** การจัดหมวดออเดอร์สำหรับจอ AD2 แยกออกมาเป็นฟังก์ชันบริสุทธิ์ */

/** §8 ค่ากลางเวลาส่งต้องต่ำกว่า 30 นาที เกินเกณฑ์นี้คือใบที่หลุดเป้าแล้ว */
export const DELAYED_AFTER_MINUTES = 30;

export type AdminOrderFilter = 'all' | 'delayed' | 'unassigned';

export type AdminOrderRow = {
  id: string;
  reference: string;
  status: OrderStatus;
  restaurantName: string;
  restaurantNameEn: string | null;
  dropoffLabel: string;
  riderName: string | null;
  grandTotalSatang: number;
  createdAt: string;
  minutesElapsed: number;
};

/** "ยังเดินอยู่" ใช้ `isActiveStatus` ที่มีอยู่แล้ว ไม่เขียนรายชื่อสถานะซ้ำที่นี่ */
export function isDelayed(row: AdminOrderRow): boolean {
  return isActiveStatus(row.status) && row.minutesElapsed > DELAYED_AFTER_MINUTES;
}

export function isUnassigned(row: AdminOrderRow): boolean {
  return isActiveStatus(row.status) && row.riderName === null;
}

export function matchesFilter(filter: AdminOrderFilter, row: AdminOrderRow): boolean {
  if (filter === 'delayed') return isDelayed(row);
  if (filter === 'unassigned') return isUnassigned(row);
  return true;
}
