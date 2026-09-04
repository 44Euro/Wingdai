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

    /**
     * รหัสชุดนี้ถูกขอไว้เพื่ออะไร ตั้งตอน "ขอรหัส" ไม่ใช่ตอน "ยืนยัน" — ผู้เรียกจึงเลือก
     * วัตถุประสงค์ของตั๋วเองไม่ได้ และข้อความ SMS บอกได้ว่ารหัสนี้ใช้ทำอะไร
     */
    purpose: text('purpose').notNull().default('phone_verify'),

    /**
     * ตั๋วใบที่ออกให้ล่าสุด ใช้แล้วล้างเป็น null ตั๋วจึงใช้ได้ครั้งเดียว
     * JWT เพิกถอนตัวเองไม่ได้ ความใช้ครั้งเดียวจึงต้องอยู่ฝั่งเซิร์ฟเวอร์
     */
    ticketId: text('ticket_id'),
  },
  (t) => [
    check('phone_verifications_phone_format', sql`${t.phone} ~ '^0[689][0-9]{8}$'`),
    check('phone_verifications_counters_sane', sql`${t.attempts} >= 0 and ${t.sendCount} >= 1`),
    check(
      'phone_verifications_purpose_known',
      sql`${t.purpose} in ('phone_verify', 'password_reset')`,
    ),
  ],
);
