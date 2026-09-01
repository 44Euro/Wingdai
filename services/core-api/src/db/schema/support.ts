import { pgTable, pgEnum, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { orders } from './orders';

/** สถานะตั๋ว สองค่าเท่านั้น (สเปคคลื่น 2 §5.6) */
export const ticketStatus = pgEnum('ticket_status', ['open', 'closed']);

/** เรื่องที่เปิดตั๋วได้ รายการปิด ไม่ใช่ข้อความอิสระ */
export const ticketKind = pgEnum('ticket_kind', [
  'order_problem',
  'payment',
  'account',
  'other',
]);

/** ตั๋วซัพพอร์ต (design AD4 สเปคคลื่น 2 §5.6) */
export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** ผูกออเดอร์ได้ แต่ไม่บังคับ ปัญหาบัญชีหรือการจ่ายเงินไม่ได้ผูกกับใบไหน */
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    openedByAccountId: uuid('opened_by_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    kind: ticketKind('kind').notNull(),
    subject: text('subject').notNull(),
    status: ticketStatus('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedByAccountId: uuid('closed_by_account_id').references(() => accounts.id),
  },
  (t) => [
    index('support_tickets_status_idx').on(t.status, t.createdAt),
    index('support_tickets_opener_idx').on(t.openedByAccountId),
  ],
);

/** ข้อความในเธรด เรียงเก่า→ใหม่ตอนอ่าน */
export const supportTicketMessages = pgTable(
  'support_ticket_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    authorAccountId: uuid('author_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_messages_thread_idx').on(t.ticketId, t.createdAt)],
);
