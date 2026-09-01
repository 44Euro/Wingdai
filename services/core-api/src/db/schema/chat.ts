import { pgTable, pgEnum, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { orders } from './orders';

/** ช่องคุยของออเดอร์หนึ่งใบ (design C10 M10) */
export const chatChannel = pgEnum('chat_channel', ['customer_rider', 'customer_merchant']);

/** ข้อความในแชทของออเดอร์ (design C10 M10) */
export const orderMessages = pgTable(
  'order_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    channel: chatChannel('channel').notNull(),
    senderAccountId: uuid('sender_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** จอเปิดมาอ่านทีละช่องของออเดอร์เดียว เรียงเก่า→ใหม่ */
    index('order_messages_thread_idx').on(t.orderId, t.channel, t.createdAt),
  ],
);
