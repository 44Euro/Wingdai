import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { sql, and, eq, isNull } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { riderIssues } from '../db/schema';
import { waitedFor } from './waitedFor';

/** จอแอดมินแบบ exception-based (product-spec §7) */

/** ร้านยังไม่กดรับเกินเวลานี้ = ลูกค้ารอโดยไม่มีใครทำอะไร (§8 อัตราการรับ > 95%) */
const UNACCEPTED_SLA_MINUTES = 5;
/** ร้านรับแล้วแต่ยังไม่มีไรเดอร์เกินเวลานี้ = การจ่ายงานมีปัญหา (§8 > 90%) */
const NO_RIDER_MINUTES = 10;
/** ส่งนานเกินนี้ = ผิดปกติ (§8 ค่ากลางเวลาส่งควรต่ำกว่า 30 นาที) */
const IN_TRANSIT_MINUTES = 45;

export type ExceptionKind =
  | 'unaccepted' | 'no_rider' | 'slow_delivery' | 'open_dispute' | 'rider_issue';

export type OrderException = {
  kind: ExceptionKind;
  orderId: string;
  reference: string;
  restaurantName: string;
  restaurantNameEn: string | null;
  status: string;
  minutesWaiting: number;
  /** อธิบายเป็นภาษาคน แอดมินต้องรู้ว่าต้องทำอะไร ไม่ใช่แค่เห็นว่ามีอะไรผิด */
  detail: string;
  /** มีค่าเฉพาะเรื่องที่ไรเดอร์แจ้ง (R9) แอดมินต้องใช้ id นี้กดเคลียร์ */
  riderIssueId?: string;
};

/** ข้อความบอกแอดมินว่าไรเดอร์เจออะไร เขียนเป็นสิ่งที่ต้องไปทำ ไม่ใช่แค่ชื่อปัญหา */
const RIDER_ISSUE_DETAIL: Record<string, string> = {
  cannot_reach_customer: 'ไรเดอร์ติดต่อลูกค้าไม่ได้ — โทรหาลูกค้าแทน หรือบอกไรเดอร์ว่าให้ทำยังไงต่อ',
  bad_address: 'ที่อยู่ผิดหรือหาไม่เจอ — โทรถามลูกค้าแล้วแจ้งพิกัดที่ถูกให้ไรเดอร์',
  accident: 'ไรเดอร์แจ้งอุบัติเหตุ — โทรหาไรเดอร์ก่อนเรื่องอื่นทั้งหมด',
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
      restaurant_name_en: string | null;
      status: string;
      minutes_waiting: number;
      rider_issue_id: string | null;
      rider_issue_kind: string | null;
      rider_issue_detail: string | null;
    }>(sql`
      -- ร้านยังไม่กดรับ
      select 'unaccepted'::text as kind, o.id as order_id, o.reference,
             r.name as restaurant_name, r.name_en as restaurant_name_en, o.status::text as status,
             (extract(epoch from (now() - o.created_at)) / 60)::int as minutes_waiting,
             null::uuid as rider_issue_id, null::text as rider_issue_kind,
             null::text as rider_issue_detail
        from orders o join restaurants r on r.id = o.restaurant_id
       where o.status = 'created'
         and o.created_at < now() - (${UNACCEPTED_SLA_MINUTES} || ' minutes')::interval

      union all

      -- ร้านรับแล้วแต่ยังไม่มีไรเดอร์
      select 'no_rider', o.id, o.reference, r.name, r.name_en, o.status::text,
             (extract(epoch from (now() - coalesce(o.accepted_at, o.created_at))) / 60)::int,
             null::uuid, null::text, null::text
        from orders o join restaurants r on r.id = o.restaurant_id
       where o.status in ('accepted', 'preparing')
         and o.rider_id is null
         and coalesce(o.accepted_at, o.created_at) < now() - (${NO_RIDER_MINUTES} || ' minutes')::interval

      union all

      -- ไรเดอร์รับของไปแล้วแต่ยังไม่ถึง
      select 'slow_delivery', o.id, o.reference, r.name, r.name_en, o.status::text,
             (extract(epoch from (now() - coalesce(o.picked_up_at, o.created_at))) / 60)::int,
             null::uuid, null::text, null::text
        from orders o join restaurants r on r.id = o.restaurant_id
       where o.status = 'picked_up'
         and coalesce(o.picked_up_at, o.created_at) < now() - (${IN_TRANSIT_MINUTES} || ' minutes')::interval

      union all

      -- ข้อพิพาทที่ยังไม่ตัดสิน
      select 'open_dispute', o.id, o.reference, r.name, r.name_en, o.status::text,
             (extract(epoch from (now() - rc.created_at)) / 60)::int,
             null::uuid, null::text, null::text
        from refund_cases rc
        join orders o on o.id = rc.order_id
        join restaurants r on r.id = o.restaurant_id
       where rc.status in ('open', 'auto_verified')

      union all

      /** ไรเดอร์แจ้งปัญหาระหว่างส่ง (design R9) */
      select 'rider_issue', o.id, o.reference, r.name, r.name_en, o.status::text,
             (extract(epoch from (now() - ri.created_at)) / 60)::int,
             ri.id, ri.kind::text, ri.detail
        from rider_issues ri
        join orders o on o.id = ri.order_id
        join restaurants r on r.id = o.restaurant_id
       where ri.resolved_at is null

      order by minutes_waiting desc
      limit 100
    `);

    return rows.map((r) => ({
      kind: r.kind,
      orderId: r.order_id,
      reference: r.reference,
      restaurantName: r.restaurant_name,
      restaurantNameEn: r.restaurant_name_en,
      status: r.status,
      minutesWaiting: r.minutes_waiting,
      detail: r.kind === 'rider_issue'
        ? riderIssueDetail(r.rider_issue_kind, r.rider_issue_detail)
        : DETAIL[r.kind](r.minutes_waiting),
      ...(r.rider_issue_id ? { riderIssueId: r.rider_issue_id } : {}),
    }));
  }

  /** แอดมินเคลียร์เรื่องที่จัดการแล้ว */
  async resolveRiderIssue(adminId: string, issueId: string) {
    const rows = await this.db
      .update(riderIssues)
      .set({ resolvedAt: new Date(), resolvedBy: adminId })
      .where(and(eq(riderIssues.id, issueId), isNull(riderIssues.resolvedAt)))
      .returning({ id: riderIssues.id });

    if (rows.length === 0) {
      throw new NotFoundException({ message: 'ไม่พบเรื่องนี้ หรือถูกเคลียร์ไปแล้ว' });
    }
    return { ok: true };
  }

  /** ตัวเลขจาก §8 ที่วัดได้ตั้งแต่วันนี้ */
  async metrics(days = 7) {
    const [row] = await this.db.execute<{
      delivered: number;
      created: number;
      accepted: number;
      refunded: number;
      rider_hours: number;
      auto_dispatched: number;
      manual_dispatched: number;
      contribution_satang: number;
      median_minutes: number | null;
      on_time: number;
      promptpay: number;
      repeat_customers: number;
      any_customers: number;
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
                            where d.order_id = o.id and d.outcome = 'accepted'))::int as manual_dispatched,

        /** §8 กำไรส่วนเพิ่มต่อออเดอร์ ต้อง > ฿0 ตั้งแต่วันแรก */
        (select coalesce(sum(
                  case when account = 'platform_revenue' then credit_satang - debit_satang
                       when account in ('payment_fee_expense', 'refund_expense')
                            then -(debit_satang - credit_satang)
                       else 0 end), 0)
           from ledger_entries
          where created_at > now() - (${days} || ' days')::interval)::int as contribution_satang,

        (select percentile_cont(0.5) within group (
                  order by extract(epoch from (delivered_at - created_at)) / 60)
           from window_orders where status = 'delivered') as median_minutes,

        /** §8 ส่งตรงเวลา > 90% "ตรงเวลา" คือถึงมือภายใน 30 นาทีตามเป้าค่ากลางของ §8 */
        (select count(*) from window_orders
          where status = 'delivered'
            and delivered_at <= created_at + interval '30 minutes')::int as on_time,

        (select count(*) from window_orders where payment_method = 'promptpay')::int as promptpay,

        /** §8 อัตราสั่งซ้ำใน 30 วัน > 40% ใช้หน้าต่าง 30 วันคงที่ ไม่ตามพารามิเตอร์ days */
        (select count(*) from (
           select customer_id from orders
            where created_at > now() - interval '30 days'
            group by customer_id having count(*) >= 2) t)::int as repeat_customers,
        (select count(distinct customer_id) from orders
          where created_at > now() - interval '30 days')::int as any_customers
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
      /** §8 < 2% เกินแล้วแปลว่ามีอะไรพังเชิงระบบ ไม่ใช่ความผันผวนปกติ */
      refundRate: ratio(row?.refunded ?? 0, delivered),
      /** §8 > 90% วัดว่าเครื่องจ่ายงานที่ดึงเข้า Phase 1 ทำงานจริงไหม */
      autoDispatchRate: ratio(row?.auto_dispatched ?? 0, assigned),

      /** ห้าตัวที่เหลือของ §8 (design SA1) */
      contributionPerOrderSatang: delivered > 0
        ? Math.round((row?.contribution_satang ?? 0) / delivered)
        : null,
      medianDeliveryMinutes: row?.median_minutes === null || row?.median_minutes === undefined
        ? null
        : Math.round(Number(row.median_minutes)),
      /** §8 > 90% */
      onTimeRate: ratio(row?.on_time ?? 0, delivered),
      /** §8 > 80% กระทบมาร์จิ้นโดยตรง (§6.5 ค่าธรรมเนียมบัตรแพงกว่าพร้อมเพย์ 2–3 เท่า) */
      promptPayRate: ratio(row?.promptpay ?? 0, created),
      /** §8 > 40% สัญญาณว่าสินค้าดีจริง ไม่ใช่แค่คนลองของใหม่ */
      repeatOrderRate: ratio(row?.repeat_customers ?? 0, row?.any_customers ?? 0),
    };
  }
}

/** ข้อความที่ไรเดอร์พิมพ์เองต่อท้ายไว้ ถ้ามี ของจริงมักละเอียดกว่าหัวข้อที่เลือก */
function riderIssueDetail(kind: string | null, typed: string | null): string {
  const base = RIDER_ISSUE_DETAIL[kind ?? ''] ?? 'ไรเดอร์แจ้งปัญหา — โทรเช็คว่าเกิดอะไรขึ้น';
  return typed ? `${base} · ไรเดอร์เขียนว่า "${typed}"` : base;
}

const DETAIL: Record<Exclude<ExceptionKind, 'rider_issue'>, (m: number) => string> = {
  unaccepted: (m) => `ร้านยังไม่กดรับมา ${waitedFor(m)} — ติดต่อร้านหรือยกเลิกให้ลูกค้า`,
  no_rider: (m) => `ยังไม่มีไรเดอร์รับมา ${waitedFor(m)} — สั่งจ่ายงานมือหรือหาไรเดอร์เพิ่มในโซนนี้`,
  slow_delivery: (m) => `ไรเดอร์รับของไปแล้ว ${waitedFor(m)}แต่ยังไม่ถึง — โทรเช็คว่าเกิดอะไรขึ้น`,
  open_dispute: (m) => `ลูกค้าแจ้งปัญหามา ${waitedFor(m)}แล้วยังไม่ได้ตัดสิน`,
};
