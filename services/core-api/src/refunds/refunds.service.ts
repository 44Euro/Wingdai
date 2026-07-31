import { randomUUID } from 'node:crypto';
import {
  Injectable, Inject, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { and, eq, sql, desc, inArray } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { orders, refundCases, ledgerEntries, accounts, restaurants } from '../db/schema';
import { postRefund, type RefundFault } from '../ledger/postRefund';
import { recommendRefund, type RefundReason, type RefundFacts } from './autoVerify';
import type { OpenCaseInput, DecideCaseInput } from './dto';

@Injectable()
export class RefundsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * ลูกค้าแจ้งปัญหา — ระบบตรวจอัตโนมัติแล้วเก็บข้อเสนอไว้รอแอดมิน (claude.md §6.4)
   * ยังไม่มีเงินออกตรงนี้ ต้องมีคนกดยืนยันก่อนเสมอ
   */
  async open(accountId: string, input: OpenCaseInput) {
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    // ตอบ 404 ไม่ใช่ 403 — 403 ยืนยันว่าออร์เดอร์รหัสนี้มีอยู่จริง
    if (!order || order.customerId !== accountId) {
      throw new NotFoundException({ message: 'ไม่พบออร์เดอร์นี้' });
    }

    const [existing] = await this.db
      .select({ id: refundCases.id })
      .from(refundCases)
      .where(and(eq(refundCases.orderId, input.orderId), inArray(refundCases.status, ['open', 'auto_verified'])))
      .limit(1);
    // แจ้งซ้ำใบเดิมคือการเปิดสองเรื่องให้แอดมินตัดสินขัดกันเอง
    if (existing) throw new ConflictException({ message: 'ออร์เดอร์นี้มีเรื่องที่กำลังตรวจอยู่แล้ว' });

    const facts = await this.factsFor(order, input.reason, input.hasPhoto);
    const rec = recommendRefund(facts);

    if (rec.verdict === 'not_eligible') {
      throw new BadRequestException({ message: rec.reasoning[0] ?? 'ไม่เข้าเงื่อนไขแจ้งปัญหา' });
    }

    const [row] = await this.db
      .insert(refundCases)
      .values({
        orderId: input.orderId,
        reportedByAccountId: accountId,
        // ตรวจอัตโนมัติแล้ว = auto_verified · ยังไม่ได้ตัดสิน แอดมินต้องกดยืนยัน
        status: 'auto_verified',
        customerReason: `${input.reason}: ${input.detail}`,
        evidencePhotoPath: input.photoPath ?? null,
        autoVerdict: rec.verdict,
        autoReasoning: rec.reasoning.join('\n'),
        suggestedAmountSatang: rec.suggestedAmountSatang,
        fault: rec.fault,
      })
      .returning();

    return this.toPublic(row!);
  }

  /** ข้อมูลที่ตัวตรวจอัตโนมัติต้องใช้ — อ่านจากฐานทุกครั้ง ไม่เชื่อสิ่งที่แอปส่งมา */
  private async factsFor(
    order: typeof orders.$inferSelect,
    reason: RefundReason,
    hasCustomerPhoto: boolean,
  ): Promise<RefundFacts> {
    const [counts] = await this.db.execute<{ order_count: number; dispute_count: number }>(sql`
      select
        (select count(*) from orders o where o.customer_id = ${order.customerId})::int as order_count,
        (select count(*) from refund_cases rc where rc.reported_by_account_id = ${order.customerId})::int as dispute_count
    `);

    return {
      reason,
      orderTotalSatang: order.foodTotalSatang + order.deliveryFeeSatang + order.serviceFeeSatang,
      orderStatus: order.status,
      deliveredAt: order.deliveredAt,
      reportedAt: new Date(),
      hasCustomerPhoto,
      hasDeliveryPhoto: !!order.deliveryPhotoPath,
      customerOrderCount: counts?.order_count ?? 0,
      customerDisputeCount: counts?.dispute_count ?? 0,
    };
  }

  /** คิวของแอดมิน — เรื่องที่ยังไม่ตัดสิน เก่าสุดก่อน */
  async listOpen() {
    const rows = await this.db
      .select({ c: refundCases, reference: orders.reference, customerName: accounts.fullName })
      .from(refundCases)
      .innerJoin(orders, eq(orders.id, refundCases.orderId))
      .innerJoin(accounts, eq(accounts.id, refundCases.reportedByAccountId))
      .where(inArray(refundCases.status, ['open', 'auto_verified']))
      .orderBy(refundCases.createdAt);

    return rows.map((r) => ({ ...this.toPublic(r.c), reference: r.reference, customerName: r.customerName }));
  }

  /**
   * แอดมินยืนยัน/แก้/ปฏิเสธ — **จุดเดียวที่เงินคืนออกจริง**
   *
   * §6.4 บอกว่าตอนยืนยันต้อง "ออกรายการกลับทางใน ledger ให้อัตโนมัติ ไม่ใช่ให้ไปแก้ยอดเอง"
   * รายการจึงถูกเขียนในทรานแซกชันเดียวกับการปิดเรื่อง — ปิดเรื่องสำเร็จแต่ ledger ไม่ขยับ
   * คือเงินหายไปจากบัญชีโดยไม่มีร่องรอย
   */
  async decide(adminAccountId: string, caseId: string, input: DecideCaseInput) {
    const now = new Date();

    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(refundCases)
        .where(eq(refundCases.id, caseId))
        .limit(1)
        .for('update');

      if (!row) throw new NotFoundException({ message: 'ไม่พบเรื่องนี้' });
      if (row.status === 'approved' || row.status === 'rejected') {
        throw new ConflictException({ message: 'เรื่องนี้ตัดสินไปแล้ว' });
      }

      if (!input.approve) {
        await tx
          .update(refundCases)
          .set({ status: 'rejected', decidedByAccountId: adminAccountId, decidedAt: now })
          .where(eq(refundCases.id, caseId));
        return;
      }

      const [order] = await tx.select().from(orders).where(eq(orders.id, row.orderId)).limit(1);
      if (!order) throw new NotFoundException({ message: 'ไม่พบออร์เดอร์ของเรื่องนี้' });

      const gross = order.foodTotalSatang + order.deliveryFeeSatang + order.serviceFeeSatang;
      const amount = input.amountSatang ?? row.suggestedAmountSatang ?? 0;
      // คืนเกินที่ลูกค้าจ่ายมาคือการสร้างเงินขึ้นมาจากอากาศ ฐานไม่มีทางจับได้เพราะยังบาลานซ์
      if (amount <= 0 || amount > gross) {
        throw new BadRequestException({
          message: `ยอดคืนต้องอยู่ระหว่าง 1 ถึง ${gross} สตางค์`,
          fields: { amountSatang: 'ยอดไม่ถูกต้อง' },
        });
      }

      const fault: RefundFault | null = input.fault ?? row.fault;
      // ไม่รู้ว่าใครรับผิดชอบ = ไม่รู้ว่าจะหักจากบัญชีไหน จ่ายไม่ได้
      if (!fault) {
        throw new BadRequestException({
          message: 'ต้องระบุว่าใครรับผิดชอบก่อนอนุมัติคืนเงิน',
          fields: { fault: 'ยังไม่ได้เลือก' },
        });
      }

      const entryGroupId = randomUUID();
      await tx.insert(ledgerEntries).values(
        postRefund({ amountSatang: amount, fault }).map((l) => ({
          entryGroupId,
          account: l.account,
          debitSatang: l.debitSatang,
          creditSatang: l.creditSatang,
          orderId: order.id,
          reason: 'refund.approved',
        })),
      );

      await tx
        .update(refundCases)
        .set({
          status: 'approved',
          approvedAmountSatang: amount,
          fault,
          decidedByAccountId: adminAccountId,
          decidedAt: now,
          ledgerEntryGroupId: entryGroupId,
        })
        .where(eq(refundCases.id, caseId));

      // ออร์เดอร์ที่คืนเงินแล้วต้องอ่านออกจากตัวมันเองว่าคืนแล้ว ไม่ใช่ต้องไปไล่ดู ledger
      await tx.update(orders).set({ paymentStatus: 'refunded' }).where(eq(orders.id, order.id));
    });

    const [after] = await this.db.select().from(refundCases).where(eq(refundCases.id, caseId)).limit(1);
    return this.toPublic(after!);
  }

  /** เรื่องที่ลูกค้าคนนี้เคยแจ้ง — ให้แอปโชว์สถานะได้โดยไม่ต้องถามแอดมิน */
  async listForCustomer(accountId: string) {
    const rows = await this.db
      .select({ c: refundCases, reference: orders.reference })
      .from(refundCases)
      .innerJoin(orders, eq(orders.id, refundCases.orderId))
      .where(eq(refundCases.reportedByAccountId, accountId))
      .orderBy(desc(refundCases.createdAt));
    return rows.map((r) => ({ ...this.toPublic(r.c), reference: r.reference }));
  }

  /**
   * §8 — อัตราคืนเงินเกิน 2% แปลว่ามีอะไรพังเชิงระบบ ต้องวัดได้ตั้งแต่วันแรก
   * ไม่ใช่รอมีแดชบอร์ดก่อนค่อยเริ่มเก็บ
   */
  async refundRate(days = 7) {
    const [row] = await this.db.execute<{ delivered: number; refunded: number }>(sql`
      select
        (select count(*) from orders o
          where o.status = 'delivered' and o.delivered_at > now() - (${days} || ' days')::interval)::int as delivered,
        (select count(*) from refund_cases rc
          where rc.status = 'approved' and rc.decided_at > now() - (${days} || ' days')::interval)::int as refunded
    `);
    const delivered = row?.delivered ?? 0;
    return {
      delivered,
      refunded: row?.refunded ?? 0,
      // ยังไม่มีออร์เดอร์ = ยังไม่มีอัตรานี้ ไม่ใช่ 0% (0% อ่านเหมือน "ดีมาก")
      rate: delivered > 0 ? Number(((row?.refunded ?? 0) / delivered).toFixed(4)) : null,
    };
  }

  private toPublic(r: typeof refundCases.$inferSelect) {
    return {
      id: r.id,
      orderId: r.orderId,
      status: r.status,
      customerReason: r.customerReason,
      autoVerdict: r.autoVerdict,
      /** แตกกลับเป็นรายข้อ — จอต้องโชว์เป็นรายการเหตุผล ไม่ใช่ก้อนข้อความเดียว */
      reasoning: r.autoReasoning ? r.autoReasoning.split('\n') : [],
      suggestedAmountSatang: r.suggestedAmountSatang,
      approvedAmountSatang: r.approvedAmountSatang,
      fault: r.fault,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
    };
  }
}
