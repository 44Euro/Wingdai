import { sql } from 'drizzle-orm';
import {
  pgTable, pgEnum, uuid, text, boolean, integer, timestamp, doublePrecision, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { orders } from './orders';
import { point, zones } from './zones';
import { riderIssueKind } from './enums';

export const offerOutcome = pgEnum('offer_outcome', ['pending', 'accepted', 'declined', 'expired']);

/** สถานะ "ตอนนี้" ของไรเดอร์ แถวเดียวต่อคน เขียนทับตลอด */
export const riderStatus = pgTable(
  'rider_status',
  {
    accountId: uuid('account_id')
      .primaryKey()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    isOnline: boolean('is_online').notNull().default(false),

    /** ตำแหน่งล่าสุด product-spec §5 กำหนดจังหวะส่ง 3–5 วิ ตอนกำลังส่งของ */
    location: point('location'),
    lastPingAt: timestamp('last_ping_at', { withTimezone: true }),

    /** เริ่มช่วงออนไลน์ปัจจุบันเมื่อไหร่ null = ออฟไลน์อยู่ */
    onlineSince: timestamp('online_since', { withTimezone: true }),
    /** จบงานล่าสุดเมื่อไหร่ ใช้คิดพจน์ fairness ตอนให้คะแนน (dispatch/scoring.ts) */
    lastJobEndedAt: timestamp('last_job_ended_at', { withTimezone: true }),

    zoneId: uuid('zone_id').references(() => zones.id),

    /** จุดตั้งทำงานที่ไรเดอร์ปักเอง + รัศมีที่ยอมรับงาน (design R7) */
    baseLocation: point('base_location'),
    baseRadiusKm: integer('base_radius_km').notNull().default(5),
  },
  (t) => [
    index('rider_status_online_idx').on(t.isOnline),
    check('rider_status_base_radius_sane', sql`${t.baseRadiusKm} between 1 and 20`),
  ],
);

/** ช่วงเวลาที่ไรเดอร์ออนไลน์ ต้องเก็บตั้งแต่วันแรก (product-spec §8) */
export const riderSessions = pgTable(
  'rider_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    zoneId: uuid('zone_id').references(() => zones.id),
    onlineAt: timestamp('online_at', { withTimezone: true }).notNull().defaultNow(),
    /** null = ยังออนไลน์อยู่ */
    offlineAt: timestamp('offline_at', { withTimezone: true }),
  },
  (t) => [
    index('rider_sessions_account_idx').on(t.accountId, t.onlineAt),
    check('rider_sessions_offline_after_online', sql`${t.offlineAt} is null or ${t.offlineAt} >= ${t.onlineAt}`),
  ],
);

/** การเสนองานทีละคนตามลำดับคะแนน (product-spec §6.3) */
export const dispatchOffers = pgTable(
  'dispatch_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    riderId: uuid('rider_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    /** เสนอเป็นคนที่เท่าไหร่ของออเดอร์ใบนี้ 1 คือคนที่คะแนนสูงสุด */
    sequence: integer('sequence').notNull(),
    score: doublePrecision('score').notNull(),

    offeredAt: timestamp('offered_at', { withTimezone: true }).notNull().defaultNow(),
    /** offeredAt + 15 วินาที (§6.3) */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    outcome: offerOutcome('outcome').notNull().default('pending'),
  },
  (t) => [
    index('dispatch_offers_rider_idx').on(t.riderId, t.outcome),
    index('dispatch_offers_order_idx').on(t.orderId, t.sequence),
    // เสนอออเดอร์ใบเดิมให้คนเดิมซ้ำไม่ได้ §6.3 บอกให้เลื่อนไปคนถัดไปเมื่อถูกปฏิเสธ
    uniqueIndex('dispatch_offers_order_rider_key').on(t.orderId, t.riderId),
    check('dispatch_offers_expires_after_offered', sql`${t.expiresAt} > ${t.offeredAt}`),
  ],
);

/** ปัญหาที่ไรเดอร์แจ้งระหว่างส่ง (design R9) */
export const riderIssues = pgTable(
  'rider_issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    riderId: uuid('rider_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    kind: riderIssueKind('kind').notNull(),
    /** รายละเอียดเพิ่มเติมที่ไรเดอร์พิมพ์เอง ไม่บังคับ */
    detail: text('detail'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => accounts.id, { onDelete: 'set null' }),
  },
  (t) => [
    index('rider_issues_order_idx').on(t.orderId),
    // คิวของแอดมินอ่านเฉพาะเรื่องที่ยังไม่เคลียร์ ดัชนีจึงคลุมเฉพาะแถวพวกนั้น
    index('rider_issues_open_idx').on(t.createdAt).where(sql`resolved_at is null`),
    check(
      'rider_issues_resolved_has_actor',
      sql`(${t.resolvedAt} is null) = (${t.resolvedBy} is null)`,
    ),
  ],
);
