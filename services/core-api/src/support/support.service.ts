import {
  Injectable, Inject, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { supportTickets, supportTicketMessages, orders, accounts } from '../db/schema';
import { isAdmin } from '../auth/roles';
import { canReadTicket, canReply } from './access';
import { isOutsideOfficeHours, nextOpenAt } from './officeHours';
import type { OpenTicketInput } from './dto';

export type TicketRow = {
  id: string;
  orderId: string | null;
  orderReference: string | null;
  kind: string;
  subject: string;
  status: 'open' | 'closed';
  createdAt: string;
  /** ชื่อคนเปิดตั๋ว คิวของแอดมินต้องอ่านออกว่ากำลังคุยกับใคร */
  openedByName: string;
  /** จำนวนข้อความในเธรด 1 = ยังไม่มีใครตอบเลย */
  messageCount: number;
};

export type TicketMessage = {
  id: string;
  authorAccountId: string;
  authorName: string;
  /** คนอ่านต้องแยกออกว่าใครเป็นฝ่ายซัพพอร์ต ไม่ใช่เดาจากชื่อ */
  fromStaff: boolean;
  body: string;
  createdAt: string;
};

/** ตั๋วซัพพอร์ต (design AD4 สเปคคลื่น 2 §5.6) */
@Injectable()
export class SupportService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** เปิดตั๋วใหม่ พร้อมข้อความแรกในเธรดเดียวกัน */
  async open(accountId: string, input: OpenTicketInput) {
    if (input.orderId) {
      const [order] = await this.db
        .select({ customerId: orders.customerId })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      // 404 ไม่ใช่ 403 403 ยืนยันว่าออร์เดอร์รหัสนี้มีอยู่จริง
      if (!order || order.customerId !== accountId) {
        throw new NotFoundException({ message: 'ไม่พบออเดอร์นี้' });
      }
    }

    return this.db.transaction(async (tx) => {
      const [ticket] = await tx
        .insert(supportTickets)
        .values({
          orderId: input.orderId ?? null,
          openedByAccountId: accountId,
          kind: input.kind,
          subject: input.subject.trim(),
        })
        .returning({ id: supportTickets.id });

      await tx.insert(supportTicketMessages).values({
        ticketId: ticket!.id,
        authorAccountId: accountId,
        body: input.body.trim(),
      });

      return { id: ticket!.id };
    });
  }

  /** ตั๋วของฉัน ใหม่สุดขึ้นก่อน */
  listMine(accountId: string) {
    return this.rows(eq(supportTickets.openedByAccountId, accountId));
  }

  /** คิวของแอดมิน ไม่ส่ง status = เอาทั้งหมด */
  listForAdmin(status?: 'open' | 'closed') {
    return this.rows(status ? eq(supportTickets.status, status) : undefined);
  }

  private async rows(where?: SQL): Promise<TicketRow[]> {
    const q = this.db
      .select({
        id: supportTickets.id,
        orderId: supportTickets.orderId,
        orderReference: orders.reference,
        kind: supportTickets.kind,
        subject: supportTickets.subject,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
        openedByName: accounts.fullName,
        /** นับด้วย subquery ที่เขียนเอง ไม่ใช่ join แล้ว group by join จะคูณแถวตั๋ว */
        messageCount: sql<number>`(
          select count(*) from ${supportTicketMessages}
           where ${supportTicketMessages.ticketId} = ${supportTickets.id}
        )::int`,
      })
      .from(supportTickets)
      .innerJoin(accounts, eq(accounts.id, supportTickets.openedByAccountId))
      .leftJoin(orders, eq(orders.id, supportTickets.orderId))
      .orderBy(desc(supportTickets.createdAt))
      .limit(200);

    const rows = await (where ? q.where(where) : q);
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      messageCount: Number(r.messageCount),
    }));
  }

  /** อ่านเธรด เจ้าของตั๋วกับผู้ดูแลระบบเท่านั้น */
  async thread(accountId: string, ticketId: string) {
    const ticket = await this.readable(accountId, ticketId);

    const messages = await this.db
      .select({
        id: supportTicketMessages.id,
        authorAccountId: supportTicketMessages.authorAccountId,
        authorName: accounts.fullName,
        authorType: accounts.accountType,
        body: supportTicketMessages.body,
        createdAt: supportTicketMessages.createdAt,
      })
      .from(supportTicketMessages)
      .innerJoin(accounts, eq(accounts.id, supportTicketMessages.authorAccountId))
      .where(eq(supportTicketMessages.ticketId, ticketId))
      // เก่า→ใหม่ อ่านจากบนลงล่างเหมือนบทสนทนา
      .orderBy(asc(supportTicketMessages.createdAt));

    const thread = messages.map((m): TicketMessage => ({
      id: m.id,
      authorAccountId: m.authorAccountId,
      authorName: m.authorName,
      fromStaff: isAdmin(m.authorType),
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    }));

    /** ตอบอัตโนมัตินอกเวลาทำการ (design AD4) */
    const answered = thread.some((m) => m.fromStaff);
    const now = new Date();
    const autoReply = !answered && ticket.status === 'open' && isOutsideOfficeHours(now)
      ? { nextOpenAt: nextOpenAt(now).toISOString() }
      : null;

    return { ticket, messages: thread, autoReply };
  }

  /** ตอบในเธรด ตั๋วที่ปิดแล้วตอบไม่ได้ ต้องเปิดใหม่ */
  async reply(accountId: string, ticketId: string, body: string) {
    const ticket = await this.readable(accountId, ticketId);
    if (!canReply(ticket.status)) {
      throw new ConflictException({ message: 'ตั๋วนี้ปิดแล้ว — เปิดตั๋วใหม่ถ้ายังมีเรื่องค้าง' });
    }

    const [row] = await this.db
      .insert(supportTicketMessages)
      .values({ ticketId, authorAccountId: accountId, body: body.trim() })
      .returning({ id: supportTicketMessages.id });

    return { id: row!.id };
  }

  /** ปิดตั๋ว แอดมินเท่านั้น (guard ที่ controller) ปิดซ้ำไม่พัง แต่ไม่เขียนทับเวลาเดิม */
  async close(adminId: string, ticketId: string) {
    const rows = await this.db
      .update(supportTickets)
      .set({ status: 'closed', closedAt: new Date(), closedByAccountId: adminId })
      .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.status, 'open')))
      .returning({ id: supportTickets.id });

    if (rows.length === 0) {
      throw new NotFoundException({ message: 'ไม่พบตั๋วนี้ หรือถูกปิดไปแล้ว' });
    }
    return { ok: true as const };
  }

  /** ตั๋วที่บัญชีนี้มีสิทธิ์อ่าน ใช้ซ้ำทั้งตอนอ่านเธรดและตอนตอบ */
  private async readable(accountId: string, ticketId: string) {
    const [ticket] = await this.db
      .select({
        id: supportTickets.id,
        orderId: supportTickets.orderId,
        kind: supportTickets.kind,
        subject: supportTickets.subject,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
        openedByAccountId: supportTickets.openedByAccountId,
      })
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);

    if (!ticket) throw new NotFoundException({ message: 'ไม่พบตั๋วนี้' });

    /** อ่าน `account_type` จากฐานทุกครั้ง ไม่อ่านจากตั๋ว JWT ที่อายุ 30 วัน (กฎเดียวกับ AdminGuard) */
    const [me] = await this.db
      .select({ type: accounts.accountType })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!me || !canReadTicket({
      viewerId: accountId, viewerType: me.type, ownerId: ticket.openedByAccountId,
    })) {
      throw new ForbiddenException({ message: 'ตั๋วนี้ไม่ใช่ของคุณ' });
    }

    return { ...ticket, createdAt: ticket.createdAt.toISOString() };
  }
}
