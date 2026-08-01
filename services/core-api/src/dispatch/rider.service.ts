import {
  Injectable, Inject, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { and, eq, desc, inArray, isNull, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import {
  accounts, riderProfiles, riderStatus, riderSessions, dispatchOffers,
  orders, orderItems, restaurants, addresses,
} from '../db/schema';
import { DispatchService } from './dispatch.service';
import { MAX_ACTIVE_JOBS } from './scoring';

/** งานที่ไรเดอร์ถืออยู่ = ยังไม่ส่งถึงและยังไม่ถูกยกเลิก */
const ACTIVE_JOB_STATUSES = ['accepted', 'preparing', 'picked_up'] as const;

export type RiderJob = {
  orderId: string;
  reference: string;
  status: 'accepted' | 'preparing' | 'picked_up';
  restaurantName: string;
  restaurantAddress: string;
  restaurantLat: number;
  restaurantLng: number;
  dropoffAddress: string;
  dropoffNote: string | null;
  dropoffLat: number;
  dropoffLng: number;
  items: { name: string; quantity: number }[];
  /** ค่าส่งคือรายได้ของไรเดอร์ใบนี้ — ไม่ใช่ยอดที่ลูกค้าจ่ายทั้งหมด */
  riderPaySatang: number;
  /** ต้องเก็บเงินสดกี่บาท · 0 = ลูกค้าจ่ายมาแล้ว */
  collectCashSatang: number;
};

@Injectable()
export class RiderService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly dispatch: DispatchService,
  ) {}

  /** ต้องเป็นบัญชี rider ที่อนุมัติแล้วเท่านั้น — บัญชี user เข้าเส้นทางนี้ไม่ได้เลย */
  private async requireApprovedRider(accountId: string) {
    const [row] = await this.db
      .select({ approval: riderProfiles.approval, accountType: accounts.accountType })
      .from(accounts)
      .leftJoin(riderProfiles, eq(riderProfiles.accountId, accounts.id))
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (row?.accountType !== 'rider') throw new NotFoundException({ message: 'ไม่พบงานของไรเดอร์' });
    if (row.approval !== 'approved') {
      throw new ForbiddenException({ message: 'บัญชีไรเดอร์ยังรออนุมัติ' });
    }
  }

  async status(accountId: string) {
    const [profile] = await this.db
      .select({ approval: riderProfiles.approval, cashHeld: riderProfiles.cashHeldSatang, cashLimit: riderProfiles.cashLimitSatang })
      .from(riderProfiles)
      .where(eq(riderProfiles.accountId, accountId))
      .limit(1);

    if (!profile) throw new NotFoundException({ message: 'ไม่พบโปรไฟล์ไรเดอร์' });

    const [state] = await this.db
      .select()
      .from(riderStatus)
      .where(eq(riderStatus.accountId, accountId))
      .limit(1);

    return {
      approval: profile.approval,
      isOnline: state?.isOnline ?? false,
      onlineSince: state?.onlineSince?.toISOString() ?? null,
      /** §6.2 เกินเพดานแล้วจะไม่ได้งานเงินสดต่อ — จอต้องบอกล่วงหน้า ไม่ใช่ให้งงว่าทำไมงานหาย */
      cashHeldSatang: profile.cashHeld,
      cashLimitSatang: profile.cashLimit,
      activeJobs: await this.jobs(accountId),
      offer: await this.currentOffer(accountId),
    };
  }

  /**
   * เปิด/ปิดรับงาน
   *
   * ทุกครั้งที่เปิดจะเปิด "ช่วงออนไลน์" ใหม่ใน rider_sessions — claude.md §8
   * Orders per Rider Hour ต้องมีตัวหาร ซึ่งคำนวณย้อนหลังไม่ได้ถ้าไม่บันทึกตอนนั้น
   */
  async setOnline(accountId: string, isOnline: boolean, at: { lat: number; lng: number } | null) {
    await this.requireApprovedRider(accountId);

    if (isOnline && !at) {
      // ไม่รู้ว่าอยู่ไหน = จ่ายงานให้ไม่ได้ (คะแนนคิดจากระยะทาง) จึงไม่ให้ออนไลน์แบบไม่มีพิกัด
      throw new ConflictException({ message: 'ต้องเปิดตำแหน่งก่อนเริ่มรับงาน' });
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(riderStatus)
        .where(eq(riderStatus.accountId, accountId))
        .limit(1);

      const location = at ? { x: at.lng, y: at.lat } : (existing?.location ?? null);

      await tx
        .insert(riderStatus)
        .values({
          accountId,
          isOnline,
          location,
          lastPingAt: at ? now : existing?.lastPingAt,
          onlineSince: isOnline ? (existing?.onlineSince ?? now) : null,
        })
        .onConflictDoUpdate({
          target: riderStatus.accountId,
          set: {
            isOnline,
            location,
            lastPingAt: at ? now : existing?.lastPingAt,
            onlineSince: isOnline ? (existing?.onlineSince ?? now) : null,
          },
        });

      // ปิดช่วงเก่าที่ค้างไว้เสมอ — แอปถูก kill กลางทางแล้วช่วงเดิมจะค้างจนตัวหารเพี้ยน
      await tx
        .update(riderSessions)
        .set({ offlineAt: now })
        .where(and(eq(riderSessions.accountId, accountId), isNull(riderSessions.offlineAt)));

      if (isOnline) await tx.insert(riderSessions).values({ accountId, onlineAt: now });
    });

    return this.status(accountId);
  }

  /**
   * ส่งพิกัดปัจจุบัน — claude.md §5 ทุก 3–5 วิ ตอนกำลังส่ง / 15–30 วิ ตอนออนไลน์เฉย ๆ
   * จังหวะเป็นหน้าที่ของแอป ฝั่งนี้แค่รับมาเก็บ
   */
  async ping(accountId: string, lat: number, lng: number) {
    const [row] = await this.db
      .update(riderStatus)
      .set({ location: { x: lng, y: lat }, lastPingAt: new Date() })
      .where(eq(riderStatus.accountId, accountId))
      .returning({ accountId: riderStatus.accountId });

    if (!row) throw new NotFoundException({ message: 'ต้องเปิดรับงานก่อนส่งตำแหน่ง' });
    return { ok: true };
  }

  /** ข้อเสนอที่ยังรอคำตอบอยู่ — จอรับงาน 15 วินาที (§6.3) */
  private async currentOffer(accountId: string) {
    const [offer] = await this.db
      .select({
        id: dispatchOffers.id,
        orderId: dispatchOffers.orderId,
        expiresAt: dispatchOffers.expiresAt,
      })
      .from(dispatchOffers)
      .where(and(eq(dispatchOffers.riderId, accountId), eq(dispatchOffers.outcome, 'pending')))
      .orderBy(desc(dispatchOffers.offeredAt))
      .limit(1);

    if (!offer) return null;
    // หมดเวลาไปแล้วแต่รอบกวาดยังไม่ถึง — อย่าโชว์งานที่กดรับไม่ได้แล้ว
    if (offer.expiresAt.getTime() <= Date.now()) return null;

    const job = await this.jobDetail(offer.orderId);
    return job ? { ...job, offerId: offer.id, expiresAt: offer.expiresAt.toISOString() } : null;
  }

  async acceptOffer(accountId: string, orderId: string): Promise<RiderJob> {
    await this.requireApprovedRider(accountId);

    await this.db.transaction(async (tx) => {
      const [offer] = await tx
        .select()
        .from(dispatchOffers)
        .where(and(eq(dispatchOffers.orderId, orderId), eq(dispatchOffers.riderId, accountId)))
        .limit(1)
        .for('update');

      if (!offer) throw new NotFoundException({ message: 'ไม่พบงานนี้' });
      if (offer.outcome !== 'pending') {
        throw new ConflictException({ message: 'งานนี้ตอบไปแล้วหรือหมดเวลาแล้ว' });
      }
      if (offer.expiresAt.getTime() <= Date.now()) {
        throw new ConflictException({ message: 'หมดเวลารับงานนี้แล้ว' });
      }

      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for('update');
      if (!order) throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });
      // มีคนรับไปแล้วระหว่างที่กด — เกิดได้จริงถ้าแอดมินจ่ายงานมือพร้อมกัน (§6.3)
      if (order.riderId) throw new ConflictException({ message: 'งานนี้มีคนรับไปแล้ว' });

      /*
       * claude.md §4.3 — ไรเดอร์รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้
       * ด่านนี้ซ้ำกับตอนคัดผู้สมัครโดยตั้งใจ เพราะการกดรับเข้ามาทางนี้ได้โดยไม่ผ่านการเสนอ
       * (เช่นแอดมินจ่ายมือ) ต้องเจอด่านเดียวกัน ฐานข้อมูลยังมี CHECK กันอีกชั้น
       */
      if (order.customerId === accountId) {
        throw new ForbiddenException({ message: 'รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้' });
      }

      const busy = await this.dispatch.activeJobCount(accountId);
      if (busy >= MAX_ACTIVE_JOBS) {
        throw new ConflictException({ message: 'ถืองานเต็มมือแล้ว ส่งของที่มีอยู่ให้เสร็จก่อน' });
      }

      await tx.update(orders).set({ riderId: accountId }).where(eq(orders.id, orderId));
      await tx
        .update(dispatchOffers)
        .set({ outcome: 'accepted', respondedAt: new Date() })
        .where(eq(dispatchOffers.id, offer.id));
    });

    return (await this.jobDetail(orderId))!;
  }

  /** ปฏิเสธ — รอบจ่ายงานถัดไปจะเลื่อนไปคนต่อไปเอง ไม่ต้องมีเส้นทางแยก */
  async declineOffer(accountId: string, orderId: string) {
    const rows = await this.db
      .update(dispatchOffers)
      .set({ outcome: 'declined', respondedAt: new Date() })
      .where(
        and(
          eq(dispatchOffers.orderId, orderId),
          eq(dispatchOffers.riderId, accountId),
          eq(dispatchOffers.outcome, 'pending'),
        ),
      )
      .returning({ id: dispatchOffers.id });

    if (rows.length === 0) throw new NotFoundException({ message: 'ไม่พบงานนี้' });
    return { ok: true };
  }

  async jobs(accountId: string): Promise<RiderJob[]> {
    const rows = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.riderId, accountId), inArray(orders.status, ACTIVE_JOB_STATUSES as never)))
      .orderBy(orders.createdAt);

    const jobs = await Promise.all(rows.map((r) => this.jobDetail(r.id)));
    return jobs.filter((j): j is RiderJob => j !== null);
  }

  private async jobDetail(orderId: string): Promise<RiderJob | null> {
    const [row] = await this.db
      .select({
        order: orders,
        shopName: restaurants.name,
        shopAddress: restaurants.addressText,
        shopLocation: restaurants.location,
        dropAddress: addresses.addressText,
        dropNote: addresses.note,
        dropLocation: addresses.location,
      })
      .from(orders)
      .innerJoin(restaurants, eq(restaurants.id, orders.restaurantId))
      .innerJoin(addresses, eq(addresses.id, orders.deliveryAddressId))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!row) return null;

    const items = await this.db
      .select({ name: orderItems.name, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const o = row.order;
    return {
      orderId: o.id,
      reference: o.reference,
      status: o.status as RiderJob['status'],
      restaurantName: row.shopName,
      restaurantAddress: row.shopAddress,
      restaurantLat: row.shopLocation.y,
      restaurantLng: row.shopLocation.x,
      dropoffAddress: row.dropAddress,
      dropoffNote: row.dropNote,
      dropoffLat: row.dropLocation.y,
      dropoffLng: row.dropLocation.x,
      items,
      riderPaySatang: o.deliveryFeeSatang,
      /*
       * ต้องเก็บเงินเฉพาะใบที่ยังไม่จ่าย — ลูกค้าที่เปลี่ยนไปจ่ายพร้อมเพย์กลางทาง (§6.5)
       * หน้าที่เก็บเงินของไรเดอร์หายไปทันที ตัวเลขนี้จึงต้องอ่านจาก paymentStatus ปัจจุบันเสมอ
       */
      collectCashSatang:
        o.paymentMethod === 'cash' && o.paymentStatus === 'pending'
          ? o.foodTotalSatang + o.deliveryFeeSatang + o.serviceFeeSatang
          : 0,
    };
  }

  /**
   * รายได้ + ประวัติงานที่ส่งสำเร็จ (design R4 · R6)
   *
   * รายได้ของไรเดอร์คือ **ค่าส่ง** ของแต่ละใบ ไม่ใช่ยอดที่ลูกค้าจ่าย — ยอดนั้นมีค่าอาหาร
   * ของร้านรวมอยู่ด้วย การเอายอดเต็มมาโชว์เป็น "รายได้" จะทำให้ไรเดอร์เข้าใจผิดทั้งเดือน
   *
   * ตั้งใจไม่คืนอันดับหรือค่าเฉลี่ยเทียบกับไรเดอร์คนอื่น — claude.md §3 ข้อ 4
   * ห้ามสร้างอะไรที่กดดันให้ไรเดอร์เร่งความเร็ว
   */
  async earnings(accountId: string, sinceDays = 7) {
    const stats = await this.ordersPerHour(accountId, sinceDays);

    const rows = await this.db
      .select({
        orderId: orders.id,
        reference: orders.reference,
        restaurantName: restaurants.name,
        dropoffAddress: addresses.addressText,
        deliveredAt: orders.deliveredAt,
        riderPaySatang: orders.deliveryFeeSatang,
        paymentMethod: orders.paymentMethod,
      })
      .from(orders)
      .innerJoin(restaurants, eq(restaurants.id, orders.restaurantId))
      .innerJoin(addresses, eq(addresses.id, orders.deliveryAddressId))
      .where(
        and(
          eq(orders.riderId, accountId),
          eq(orders.status, 'delivered'),
          sql`${orders.deliveredAt} > now() - (${sinceDays} || ' days')::interval`,
        ),
      )
      .orderBy(desc(orders.deliveredAt));

    return {
      ...stats,
      sinceDays,
      totalPaySatang: rows.reduce((sum, r) => sum + r.riderPaySatang, 0),
      deliveries: rows.map((r) => ({
        orderId: r.orderId,
        reference: r.reference,
        restaurantName: r.restaurantName,
        dropoffAddress: r.dropoffAddress,
        // ผ่านด่าน status = 'delivered' มาแล้ว deliveredAt จึงมีค่าเสมอ
        deliveredAt: r.deliveredAt!.toISOString(),
        riderPaySatang: r.riderPaySatang,
        paymentMethod: r.paymentMethod,
      })),
    };
  }

  /** §8 Orders per Rider Hour ของไรเดอร์คนนี้ — ตัวเลขที่โมเดลทั้งหมดวัดตัวเองด้วย */
  async ordersPerHour(accountId: string, sinceDays = 7) {
    const [row] = await this.db.execute<{ hours: number; delivered: number }>(sql`
      select
        coalesce(sum(extract(epoch from (coalesce(offline_at, now()) - online_at)))/3600.0, 0)::float8 as hours,
        (select count(*) from orders o
           where o.rider_id = ${accountId}
             and o.status = 'delivered'
             and o.delivered_at > now() - (${sinceDays} || ' days')::interval)::int as delivered
      from rider_sessions
      where account_id = ${accountId} and online_at > now() - (${sinceDays} || ' days')::interval
    `);

    const hours = row?.hours ?? 0;
    return {
      hours: Number(hours.toFixed(2)),
      delivered: row?.delivered ?? 0,
      // ยังไม่เคยออนไลน์ = ยังไม่มีค่านี้ ไม่ใช่ 0 (0 อ่านเหมือน "ทำได้แย่")
      ordersPerHour: hours > 0 ? Number(((row?.delivered ?? 0) / hours).toFixed(2)) : null,
    };
  }
}
