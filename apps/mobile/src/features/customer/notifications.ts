import type { Order, OrderStatus, Restaurant } from '../../data/types';

export type NotificationGroup = 'today' | 'earlier';

export type AppNotification = {
  id: string;
  orderId: string;
  /** i18n key ของหัวข้อ */
  titleKey: string;
  /** i18n key ของคำอธิบาย — รับตัวแปร { restaurant } */
  bodyKey: string;
  restaurantName: string;
  /** ISO string ของเวลาที่เกิดเหตุการณ์ */
  at: string;
  group: NotificationGroup;
  unread: boolean;
};

/** ไอคอนต่อสถานะ — สถานะที่จบแล้วใช้โทนกลาง สถานะที่ยังวิ่งอยู่ใช้โทนแบรนด์ */
export const NOTIFICATION_TONE: Record<OrderStatus, 'brand' | 'teal' | 'neutral'> = {
  created: 'neutral',
  accepted: 'teal',
  preparing: 'brand',
  picked_up: 'brand',
  delivered: 'teal',
  cancelled: 'neutral',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * รายการแจ้งเตือนสร้างจากออร์เดอร์จริงของผู้ใช้ ไม่ได้เก็บเป็นตารางแยก
 *
 * เหตุผล: Phase 1 ยังไม่มี push/ตาราง notification จริง ถ้าสร้าง entity ปลอมขึ้นมา
 * จอนี้จะโชว์ข้อความที่ไม่ได้เกิดขึ้นจริง — ได้จอสวยแต่หลอกผู้ใช้
 * พอต่อ backend จริงแล้วค่อยเปลี่ยนตัวป้อนข้อมูล จอไม่ต้องแก้
 */
export function buildNotifications(
  orders: Order[],
  restaurants: Restaurant[],
  lastReadAt: string | null,
  now: number = Date.now(),
): AppNotification[] {
  const nameOf = new Map(restaurants.map((r) => [r.id, r.name]));
  return orders
    .map((o) => ({
      id: `${o.id}-${o.status}`,
      orderId: o.id,
      titleKey: `customer.notifications.status.${o.status}.title`,
      bodyKey: `customer.notifications.status.${o.status}.body`,
      restaurantName: nameOf.get(o.restaurantId) ?? '',
      at: o.createdAt,
      group: (now - new Date(o.createdAt).getTime() < DAY_MS ? 'today' : 'earlier') as NotificationGroup,
      unread: lastReadAt === null || o.createdAt > lastReadAt,
    }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function countUnread(list: AppNotification[]): number {
  return list.filter((n) => n.unread).length;
}
