import { sql } from 'drizzle-orm';
import {
  pgTable, pgEnum, uuid, boolean, integer, timestamp, doublePrecision, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { orders } from './orders';
import { point, zones } from './zones';

export const offerOutcome = pgEnum('offer_outcome', ['pending', 'accepted', 'declined', 'expired']);

/**
 * สถานะ "ตอนนี้" ของไรเดอร์ — แถวเดียวต่อคน เขียนทับตลอด
 * ประวัติการออนไลน์อยู่ที่ rider_sessions ไม่ใช่ตารางนี้
 */
export const riderStatus = pgTable(
  'rider_status',
  {
    accountId: uuid('account_id')
      .primaryKey()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    isOnline: boolean('is_online').notNull().default(false),

    /**
     * ตำแหน่งล่าสุด — claude.md §5 กำหนดจังหวะส่ง 3–5 วิ ตอนกำลังส่งของ
     * และผ่อนเป็น 15–30 วิ ตอนออนไลน์เฉย ๆ เพื่อประหยัดแบต
     */
    location: point('location'),
    lastPingAt: timestamp('last_ping_at', { withTimezone: true }),

    /** เริ่มช่วงออนไลน์ปัจจุบันเมื่อไหร่ — null = ออฟไลน์อยู่ */
    onlineSince: timestamp('online_since', { withTimezone: true }),
    /** จบงานล่าสุดเมื่อไหร่ — ใช้คิดพจน์ fairness ตอนให้คะแนน (dispatch/scoring.ts) */
    lastJobEndedAt: timestamp('last_job_ended_at', { withTimezone: true }),

    zoneId: uuid('zone_id').references(() => zones.id),
  },
  (t) => [index('rider_status_online_idx').on(t.isOnline)],
);

/**
 * ช่วงเวลาที่ไรเดอร์ออนไลน์ — **ต้องเก็บตั้งแต่วันแรก** (claude.md §8)
 *
 * Orders per Rider Hour คือ North Star Metric และคำนวณย้อนหลังไม่ได้ถ้าไม่มีตารางนี้
 * ตัวหารของสูตรอยู่ที่นี่ ตัวตั้งอยู่ที่ orders.delivered_at
 */
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

/**
 * การเสนองานทีละคนตามลำดับคะแนน (claude.md §6.3)
 *
 * เก็บทุกครั้งที่เสนอ **รวมทั้งที่ถูกปฏิเสธและที่หมดเวลา** เพราะ §8 วัด
 * "อัตราการจ่ายงานสำเร็จ > 90%" ซึ่งคิดจากใบที่ต้องใช้แอดมินแทรกมือ
 * ถ้าเก็บแต่ใบที่สำเร็จ ตัวหารจะหายไปทั้งก้อน
 */
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
    /** เสนอเป็นคนที่เท่าไหร่ของออร์เดอร์ใบนี้ — 1 คือคนที่คะแนนสูงสุด */
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
    // เสนอออร์เดอร์ใบเดิมให้คนเดิมซ้ำไม่ได้ — §6.3 บอกให้เลื่อนไปคนถัดไปเมื่อถูกปฏิเสธ
    uniqueIndex('dispatch_offers_order_rider_key').on(t.orderId, t.riderId),
    check('dispatch_offers_expires_after_offered', sql`${t.expiresAt} > ${t.offeredAt}`),
  ],
);
