import { Injectable, Inject, Logger } from '@nestjs/common';
import { and, eq, inArray, sql, lte, isNull } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { orders, dispatchOffers, riderStatus } from '../db/schema';
import {
  rankRiders, scoreRider, completionRateOf, shouldDispatchNow,
  OFFER_TIMEOUT_MS, type RiderCandidate,
} from './scoring';
import { ineligibleReason, type RiderEligibilityInput, type JobEligibilityInput } from './eligibility';
import { PlatformService } from '../platform/platform.service';

/** สถานะที่ออเดอร์ยังต้องการไรเดอร์ `created` ยังไม่นับ เพราะร้านยังไม่รับ */
const NEEDS_RIDER: ('accepted' | 'preparing')[] = ['accepted', 'preparing'];
/** งานที่ไรเดอร์ถืออยู่จริง ณ ตอนนี้ */
const RIDER_BUSY_STATUSES = ['accepted', 'preparing', 'picked_up'];

type CandidateRow = RiderCandidate &
  RiderEligibilityInput & {
    ineligible?: string;
    /** ระยะจากจุดตั้งทำงานถึงร้าน null = ยังไม่ปักหมุด (design R7) */
    baseDistanceKm: number | null;
    baseRadiusKm: number;
  };

@Injectable()
export class DispatchService {
  private readonly log = new Logger('Dispatch');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly platform: PlatformService,
  ) {}

  /** เดินเครื่องจ่ายงานหนึ่งรอบ (product-spec §6.3) */
  async tick(now: Date = new Date()): Promise<{ expired: number; offered: number }> {
    const expired = await this.expireStaleOffers(now);

    const waiting = await this.db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        restaurantId: orders.restaurantId,
        predictedReadyAt: orders.predictedReadyAt,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        foodTotalSatang: orders.foodTotalSatang,
        deliveryFeeSatang: orders.deliveryFeeSatang,
        serviceFeeSatang: orders.serviceFeeSatang,
      })
      .from(orders)
      .where(and(inArray(orders.status, NEEDS_RIDER), isNull(orders.riderId)))
      .orderBy(orders.createdAt);

    /** §6.3 บอกให้เก็บทางแทรกมือไว้เป็นตาข่ายนิรภัยเสมอ flag นี้คือสวิตช์ของตาข่ายนั้น */
    if (!(await this.platform.isEnabled('auto_dispatch'))) return { expired, offered: 0 };

    let offered = 0;
    for (const order of waiting) {
      // มีข้อเสนอค้างอยู่แล้ว = กำลังรอคนตอบ อย่าเสนอซ้อน
      const [pending] = await this.db
        .select({ id: dispatchOffers.id })
        .from(dispatchOffers)
        .where(and(eq(dispatchOffers.orderId, order.id), eq(dispatchOffers.outcome, 'pending')))
        .limit(1);
      if (pending) continue;

      if (await this.offerNext(order, now)) offered += 1;
    }

    return { expired, offered };
  }

  /** แอดมินสั่งจ่ายงานเดี๋ยวนี้ §6.3 กำหนดให้มีทางแทรกมือไว้เป็นตาข่ายนิรภัยเสมอ */
  async forceDispatch(orderId: string) {
    const [order] = await this.db
      .select({
        id: orders.id,
        status: orders.status,
        riderId: orders.riderId,
        customerId: orders.customerId,
        restaurantId: orders.restaurantId,
        predictedReadyAt: orders.predictedReadyAt,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        foodTotalSatang: orders.foodTotalSatang,
        deliveryFeeSatang: orders.deliveryFeeSatang,
        serviceFeeSatang: orders.serviceFeeSatang,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) return { offered: false, reason: 'ไม่พบออเดอร์นี้' };
    if (order.riderId) return { offered: false, reason: 'ออเดอร์นี้มีไรเดอร์แล้ว' };

    const [pending] = await this.db
      .select({ id: dispatchOffers.id })
      .from(dispatchOffers)
      .where(and(eq(dispatchOffers.orderId, orderId), eq(dispatchOffers.outcome, 'pending')))
      .limit(1);
    if (pending) return { offered: false, reason: 'มีข้อเสนอค้างอยู่ รออีก 15 วินาที' };

    const offered = await this.offerNext(order, new Date(), { ignoreTiming: true });
    return { offered, reason: offered ? null : 'ยังไม่มีไรเดอร์ที่รับงานใบนี้ได้' };
  }

  /** ข้อเสนอที่เลย 15 วินาทีถือว่าไม่ตอบ §6.3 ให้เลื่อนไปคนถัดไป */
  private async expireStaleOffers(now: Date): Promise<number> {
    const rows = await this.db
      .update(dispatchOffers)
      .set({ outcome: 'expired', respondedAt: now })
      .where(and(eq(dispatchOffers.outcome, 'pending'), lte(dispatchOffers.expiresAt, now)))
      .returning({ id: dispatchOffers.id });
    return rows.length;
  }

  /** เสนอออเดอร์ใบนี้ให้ไรเดอร์คะแนนสูงสุดที่ยังไม่เคยถูกเสนอ */
  private async offerNext(
    order: {
      id: string; customerId: string; restaurantId: string;
      predictedReadyAt: Date | null;
      paymentMethod: 'promptpay' | 'cash' | 'card';
      paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
      foodTotalSatang: number; deliveryFeeSatang: number; serviceFeeSatang: number;
    },
    now: Date,
    opts: { ignoreTiming?: boolean } = {},
  ): Promise<boolean> {
    const candidates = await this.candidatesFor(order.restaurantId, now);
    if (candidates.length === 0) return false;

    const job: JobEligibilityInput = {
      customerId: order.customerId,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      grossSatang: order.foodTotalSatang + order.deliveryFeeSatang + order.serviceFeeSatang,
    };

    const seen = await this.db
      .select({ riderId: dispatchOffers.riderId })
      .from(dispatchOffers)
      .where(eq(dispatchOffers.orderId, order.id));
    // เคยเสนอไปแล้วไม่เสนอซ้ำ ไม่ว่าจะจบด้วยปฏิเสธหรือหมดเวลา
    const declinedBy = new Set(seen.map((s) => s.riderId));

    const today = now.toISOString().slice(0, 10);
    const eligible = candidates.filter(
      (c) => ineligibleReason({ rider: c, job, declinedBy, today }) === null,
    );
    if (eligible.length === 0) return false;

    /** จังหวะจ่ายงาน คิดจากไรเดอร์ที่ใกล้ที่สุด ไม่ใช่คนที่คะแนนสูงสุด */
    const nearestKm = Math.min(...eligible.map((c) => c.distanceKm));
    const timingOk =
      opts.ignoreTiming ||
      shouldDispatchNow({
        predictedReadyAt: order.predictedReadyAt,
        nearestRiderDistanceKm: nearestKm,
        now: now.getTime(),
      });
    if (!timingOk) return false;

    const best = rankRiders(eligible)[0]!;

    await this.db.insert(dispatchOffers).values({
      orderId: order.id,
      riderId: best.accountId,
      sequence: seen.length + 1,
      score: scoreRider(best),
      offeredAt: now,
      expiresAt: new Date(now.getTime() + OFFER_TIMEOUT_MS),
    });

    this.log.log(`เสนอ ${order.id} ให้ ${best.accountId} (ลำดับที่ ${seen.length + 1})`);
    return true;
  }

  /** ไรเดอร์ที่ออนไลน์อยู่พร้อมตัวเลขที่ใช้ให้คะแนน */
  private async candidatesFor(restaurantId: string, now: Date): Promise<CandidateRow[]> {
    const rows = await this.db.execute<{
      account_id: string;
      approval: 'pending' | 'approved' | 'rejected';
      is_online: boolean;
      cash_held_satang: number;
      cash_limit_satang: number;
      licence_expiry: string;
      compulsory_insurance_expiry: string;
      distance_km: number;
      /** ระยะจากจุดตั้งทำงานถึงร้าน null = ไรเดอร์ยังไม่ปักหมุด จึงไม่กรอง */
      base_distance_km: number | null;
      base_radius_km: number;
      idle_seconds: number;
      active_jobs: number;
      completed: number;
      assigned: number;
    }>(sql`
      select
        rs.account_id,
        rp.approval,
        rs.is_online,
        rp.cash_held_satang,
        rp.cash_limit_satang,
        rp.licence_expiry::text as licence_expiry,
        rp.compulsory_insurance_expiry::text as compulsory_insurance_expiry,
        (st_distance(rs.location::geography, shop.location::geography) / 1000.0)::float8 as distance_km,
        case when rs.base_location is null then null
             else (st_distance(rs.base_location::geography, shop.location::geography) / 1000.0)::float8
        end as base_distance_km,
        rs.base_radius_km,
        extract(epoch from (${now.toISOString()}::timestamptz - coalesce(rs.last_job_ended_at, rs.online_since, ${now.toISOString()}::timestamptz)))::float8 as idle_seconds,
        (select count(*) from orders o
           where o.rider_id = rs.account_id
             and o.status in ('accepted','preparing','picked_up'))::int as active_jobs,
        (select count(*) from orders o
           where o.rider_id = rs.account_id and o.status = 'delivered')::int as completed,
        (select count(*) from orders o where o.rider_id = rs.account_id)::int as assigned
      from rider_status rs
      join rider_profiles rp on rp.account_id = rs.account_id
      cross join (select location from restaurants where id = ${restaurantId}) shop
      where rs.is_online = true and rs.location is not null
    `);

    return rows.map((r) => ({
      accountId: r.account_id,
      approval: r.approval,
      isOnline: r.is_online,
      cashHeldSatang: r.cash_held_satang,
      cashLimitSatang: r.cash_limit_satang,
      licenceExpiry: r.licence_expiry,
      compulsoryInsuranceExpiry: r.compulsory_insurance_expiry,
      distanceKm: r.distance_km,
      baseDistanceKm: r.base_distance_km,
      baseRadiusKm: r.base_radius_km,
      idleSeconds: r.idle_seconds,
      activeJobs: r.active_jobs,
      completionRate: completionRateOf(r.completed, r.assigned),
    }));
  }

  /** ใช้โดยจอแอดมิน: ทำไมออเดอร์ใบนี้ยังไม่มีไรเดอร์ (§7 จอแบบ exception-based) */
  async explain(orderId: string) {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return null;

    const now = new Date();
    const candidates = await this.candidatesFor(order.restaurantId, now);
    const seen = await this.db
      .select({ riderId: dispatchOffers.riderId, outcome: dispatchOffers.outcome })
      .from(dispatchOffers)
      .where(eq(dispatchOffers.orderId, orderId));

    const job: JobEligibilityInput = {
      customerId: order.customerId,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      grossSatang: order.foodTotalSatang + order.deliveryFeeSatang + order.serviceFeeSatang,
    };
    const declinedBy = new Set(seen.map((s) => s.riderId));
    const today = now.toISOString().slice(0, 10);

    return {
      orderId,
      status: order.status,
      riderId: order.riderId,
      offers: seen,
      candidates: candidates.map((c) => ({
        accountId: c.accountId,
        distanceKm: Number(c.distanceKm.toFixed(2)),
        score: Number(scoreRider(c).toFixed(3)),
        ineligible: ineligibleReason({ rider: c, job, declinedBy, today }),
      })),
    };
  }

  /** ไรเดอร์ปิดงาน บันทึกเวลาไว้ให้พจน์ fairness ใช้ในรอบถัดไป */
  async markJobEnded(riderId: string, at: Date = new Date()) {
    await this.db
      .update(riderStatus)
      .set({ lastJobEndedAt: at })
      .where(eq(riderStatus.accountId, riderId));
  }

  /** ไรเดอร์ถือกี่งานอยู่ตอนนี้ ใช้กันรับงานเกินตัวตอนกดรับ */
  async activeJobCount(riderId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.riderId, riderId), inArray(orders.status, RIDER_BUSY_STATUSES as never)));
    return row?.n ?? 0;
  }
}
