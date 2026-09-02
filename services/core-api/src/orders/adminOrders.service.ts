import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { matchesFilter, type AdminOrderFilter, type AdminOrderRow } from './adminOrders';
import type { OrderStatus } from './stateMachine';

/** ตัวเลขสดของจอ AD1 ตอบว่า "ตอนนี้เกิดอะไรขึ้นบ้าง" ไม่ใช่ "เดือนที่แล้วเป็นไง" */
export type LiveOps = {
  activeOrders: number;
  ridersOnline: number;
  unassigned: number;
  gmvTodaySatang: number;
  /** null = วันนี้ยังไม่มีออเดอร์ที่ส่งสำเร็จ ห้ามคืน 0 เพราะ 0 อ่านเหมือน "เร็วมาก" */
  medianDeliveryMinutes: number | null;
};

@Injectable()
export class AdminOrdersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** ออเดอร์ทุกใบสำหรับ AD2 */
  async listOrders(filter: AdminOrderFilter, limit = 200): Promise<AdminOrderRow[]> {
    const rows = await this.db.execute<{
      id: string;
      reference: string;
      status: OrderStatus;
      restaurant_name: string;
      restaurant_name_en: string | null;
      dropoff_label: string;
      rider_name: string | null;
      grand_total_satang: number;
      created_at: Date;
      minutes_elapsed: number;
    }>(sql`
      select o.id, o.reference, o.status, r.name as restaurant_name, r.name_en as restaurant_name_en,
             a.label as dropoff_label, ra.full_name as rider_name,
             /** ยอดที่ลูกค้าจ่ายไม่มีเก็บเป็นคอลัมน์ บวกสามช่องเอา */
             (o.food_total_satang + o.delivery_fee_satang + o.service_fee_satang)
               as grand_total_satang,
             o.created_at,
             (extract(epoch from (now() - o.created_at)) / 60)::int as minutes_elapsed
        from orders o
        join restaurants r on r.id = o.restaurant_id
        join addresses a on a.id = o.delivery_address_id
        left join accounts ra on ra.id = o.rider_id
       order by o.created_at desc
       limit ${limit}
    `);

    return rows
      .map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        restaurantName: r.restaurant_name,
        restaurantNameEn: r.restaurant_name_en,
        dropoffLabel: r.dropoff_label,
        riderName: r.rider_name,
        grandTotalSatang: r.grand_total_satang,
        createdAt: new Date(r.created_at).toISOString(),
        minutesElapsed: r.minutes_elapsed,
      }))
      .filter((row) => matchesFilter(filter, row));
  }

  async liveOps(): Promise<LiveOps> {
    const [row] = await this.db.execute<{
      active_orders: number;
      riders_online: number;
      unassigned: number;
      gmv_today_satang: number;
      median_minutes: number | null;
    }>(sql`
      select
        (select count(*) from orders
          where status not in ('delivered', 'cancelled'))::int as active_orders,
        (select count(*) from rider_status where is_online)::int as riders_online,
        (select count(*) from orders
          where status not in ('delivered', 'cancelled') and rider_id is null)::int as unassigned,
        /** GMV วันนี้นับเฉพาะใบที่ส่งถึงแล้ว ใบที่ยังวิ่งอยู่อาจถูกยกเลิก */
        (select coalesce(
                  sum(food_total_satang + delivery_fee_satang + service_fee_satang), 0)
           from orders
          where status = 'delivered' and delivered_at >= date_trunc('day', now()))::int
          as gmv_today_satang,
        (select percentile_cont(0.5) within group (
                  order by extract(epoch from (delivered_at - created_at)) / 60)
           from orders
          where status = 'delivered' and delivered_at >= date_trunc('day', now()))
          as median_minutes
    `);

    return {
      activeOrders: row?.active_orders ?? 0,
      ridersOnline: row?.riders_online ?? 0,
      unassigned: row?.unassigned ?? 0,
      gmvTodaySatang: row?.gmv_today_satang ?? 0,
      medianDeliveryMinutes:
        row?.median_minutes === null || row?.median_minutes === undefined
          ? null
          : Math.round(Number(row.median_minutes)),
    };
  }
}
