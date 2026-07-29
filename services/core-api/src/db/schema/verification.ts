import { sql } from 'drizzle-orm';
import { pgTable, text, integer, timestamp, check } from 'drizzle-orm/pg-core';

/** product-spec §4.2 ยืนยันเบอร์ครั้งเดียวตอนสมัคร */
export const phoneVerifications = pgTable(
  'phone_verifications',
  {
    phone: text('phone').primaryKey(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    /** กรอกผิดกี่ครั้งแล้วสำหรับรหัสชุดปัจจุบัน เกินเพดานแล้วรหัสนี้ตายทันที */
    attempts: integer('attempts').notNull().default(0),

    /** ขอรหัสใหม่กี่ครั้งในหน้าต่างเวลานี้ กันคนใช้ระบบเราไล่ส่ง SMS ใส่เบอร์คนอื่น */
    sendCount: integer('send_count').notNull().default(1),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull().defaultNow(),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull().defaultNow(),

    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (t) => [
    check('phone_verifications_phone_format', sql`${t.phone} ~ '^0[689][0-9]{8}$'`),
    check('phone_verifications_counters_sane', sql`${t.attempts} >= 0 and ${t.sendCount} >= 1`),
  ],
);
