import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';

/**
 * จอแอดมินแบบ exception-based (claude.md §7)
 *
 * **ไม่ใช่ฟีดออร์เดอร์สดทั้งหมด** — §7 บอกไว้ตรง ๆ ว่าฟีดแบบนั้นใช้ไม่ได้พอปริมาณโต
 * และการทำทีหลังคือการรื้อ ไม่ใช่การเพิ่มสวิตช์ จอนี้จึงตอบคำถามเดียว:
 * "ตอนนี้มีอะไรที่ต้องมีคนเข้าไปยุ่งบ้าง"
 *
 * §7 ระบุสามอย่างไว้ชัด: เลย SLA · ข้อพิพาทที่ยังไม่จบ · ไม่มีไรเดอร์เกิน N นาที
 */

/** ร้านยังไม่กดรับเกินเวลานี้ = ลูกค้ารอโดยไม่มีใครทำอะไร (§8 อัตราการรับ > 95%) */
const UNACCEPTED_SLA_MINUTES = 5;
/** ร้านรับแล้วแต่ยังไม่มีไรเดอร์เกินเวลานี้ = การจ่ายงานมีปัญหา (§8 > 90%) */
const NO_RIDER_MINUTES = 10;
/** ส่งนานเกินนี้ = ผิดปกติ (§8 ค่ากลางเวลาส่งควรต่ำกว่า 30 นาที) */
const IN_TRANSIT_MINUTES = 45;

export type ExceptionKind = 'unaccepted' | 'no_rider' | 'slow_delivery' | 'open_dispute';

export type OrderException = {
  kind: ExceptionKind;
  orderId: string;
  reference: string;
  restaurantName: string;
  status: string;
  minutesWaiting: number;
  /** อธิบายเป็นภาษาคน — แอดมินต้องรู้ว่าต้องทำอะไร ไม่ใช่แค่เห็นว่ามีอะไรผิด */
  detail: string;
};

@Injectable()
export class ExceptionsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(): Promise<OrderException[]> {
    const rows = await this.db.execute<{
      kind: ExceptionKind;
      order_id: string;
      reference: string;
      restaurant_name: string;
      status: string;
      minutes_waiting: number;
    }>(sql`
      -- ร้านยังไม่กดรับ
      select 'unaccepted'::text as kind, o.id as order_id, o.reference,
             r.name as restaurant_name, o.status::text as status,
             (extract(epoch from (now() - o.created_at)) / 60)::int as minutes_waiting
        from orders o join restaurants r on r.id = o.restaurant_id
       where o.status = 'created'
         and o.created_at < now() - (${UNACCEPTED_SLA_MINUTES} || ' minutes')::interval

      union all

      -- ร้านรับแล้วแต่ยังไม่มีไรเดอร์
      select 'no_rider', o.id, o.reference, r.name, o.status::text,
             (extract(epoch from (now() - coalesce(o.accepted_at, o.created_at))) / 60)::int
        from orders o join restaurants r on r.id = o.restaurant_id
       where o.status in ('accepted', 'preparing')
         and o.rider_id is null
         and coalesce(o.accepted_at, o.created_at) < now() - (${NO_RIDER_MINUTES} || ' minutes')::interval

      union all

      -- ไรเดอร์รับของไปแล้วแต่ยังไม่ถึง
      select 'slow_delivery', o.id, o.reference, r.name, o.status::text,
             (extract(epoch from (now() - coalesce(o.picked_up_at, o.created_at))) / 60)::int
        from orders o join restaurants r on r.id = o.restaurant_id
       where o.status = 'picked_up'
         and coalesce(o.picked_up_at, o.created_at) < now() - (${IN_TRANSIT_MINUTES} || ' minutes')::interval

      union all

      -- ข้อพิพาทที่ยังไม่ตัดสิน
      select 'open_dispute', o.id, o.reference, r.name, o.status::text,
             (extract(epoch from (now() - rc.created_at)) / 60)::int
        from refund_cases rc
        join orders o on o.id = rc.order_id
        join restaurants r on r.id = o.restaurant_id
       where rc.status in ('open', 'auto_verified')

      order by minutes_waiting desc
      limit 100
    `);

    return rows.map((r) => ({
      kind: r.kind,
      orderId: r.order_id,
      reference: r.reference,
      restaurantName: r.restaurant_name,
      status: r.status,
      minutesWaiting: r.minutes_waiting,
      detail: DETAIL[r.kind](r.minutes_waiting),
    }));
  }

  /**
   * ตัวเลขจาก §8 ที่วัดได้ตั้งแต่วันนี้
   *
   * ตัวที่ยังวัดไม่ได้ **ไม่ใส่มาเป็น 0** — 0 อ่านเหมือน "แย่มาก" หรือ "ดีมาก"
   * แล้วแต่ตัวชี้วัด ทั้งที่ความจริงคือยังไม่มีข้อมูล จึงคืน null ให้จอซ่อนไป
   */
  async metrics(days = 7) {
    const [row] = await this.db.execute<{
      delivered: number;
      created: number;
      accepted: number;
      refunded: number;
      rider_hours: number;
      auto_dispatched: number;
      manual_dispatched: number;
    }>(sql`
      with window_orders as (
        select * from orders where created_at > now() - (${days} || ' days')::interval
      )
      select
        (select count(*) from window_orders where status = 'delivered')::int as delivered,
        (select count(*) from window_orders)::int as created,
        (select count(*) from window_orders where accepted_at is not null)::int as accepted,
        (select count(*) from refund_cases
          where status = 'approved' and decided_at > now() - (${days} || ' days')::interval)::int as refunded,
        (select coalesce(sum(extract(epoch from (coalesce(offline_at, now()) - online_at))) / 3600.0, 0)
           from rider_sessions where online_at > now() - (${days} || ' days')::interval)::float8 as rider_hours,
        (select count(distinct order_id) from dispatch_offers
          where outcome = 'accepted' and offered_at > now() - (${days} || ' days')::interval)::int as auto_dispatched,
        (select count(*) from window_orders o where o.rider_id is not null
           and not exists (select 1 from dispatch_offers d
                            where d.order_id = o.id and d.outcome = 'accepted'))::int as manual_dispatched
    `);

    const created = row?.created ?? 0;
    const delivered = row?.delivered ?? 0;
    const hours = row?.rider_hours ?? 0;
    const assigned = (row?.auto_dispatched ?? 0) + (row?.manual_dispatched ?? 0);

    const ratio = (num: number, den: number) => (den > 0 ? Number((num / den).toFixed(4)) : null);

    return {
      windowDays: days,
      orders: created,
      delivered,
      /** §8 North Star ≥ 3.0 */
      ordersPerRiderHour: hours > 0 ? Number((delivered / hours).toFixed(2)) : null,
      /** §8 > 95% */
      restaurantAcceptRate: ratio(row?.accepted ?? 0, created),
      /** §8 < 2% — เกินแล้วแปลว่ามีอะไรพังเชิงระบบ ไม่ใช่ความผันผวนปกติ */
      refundRate: ratio(row?.refunded ?? 0, delivered),
      /** §8 > 90% — วัดว่าเครื่องจ่ายงานที่ดึงเข้า Phase 1 ทำงานจริงไหม */
      autoDispatchRate: ratio(row?.auto_dispatched ?? 0, assigned),
    };
  }
}

const DETAIL: Record<ExceptionKind, (m: number) => string> = {
  unaccepted: (m) => `ร้านยังไม่กดรับมา ${m} นาที — ติดต่อร้านหรือยกเลิกให้ลูกค้า`,
  no_rider: (m) => `ยังไม่มีไรเดอร์รับมา ${m} นาที — สั่งจ่ายงานมือหรือหาไรเดอร์เพิ่มในโซนนี้`,
  slow_delivery: (m) => `ไรเดอร์รับของไปแล้ว ${m} นาทีแต่ยังไม่ถึง — โทรเช็คว่าเกิดอะไรขึ้น`,
  open_dispute: (m) => `ลูกค้าแจ้งปัญหามา ${m} นาทีแล้วยังไม่ได้ตัดสิน`,
};
