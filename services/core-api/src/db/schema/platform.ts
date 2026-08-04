import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp, jsonb, index, check } from 'drizzle-orm/pg-core';
import { satang } from './money';
import { accounts } from './accounts';

/** ราคาและค่าธรรมเนียมของแพลตฟอร์ม (design SA6) */
export const platformPricing = pgTable(
  'platform_pricing',
  {
    singleton: boolean('singleton').primaryKey().default(true),

    /** product-spec §6.1 ตั้งต้น 1500 bp (15%) คิดจากค่าอาหารเท่านั้น */
    commissionRateBp: satang('commission_rate_bp').notNull().default(1500),

    /** ค่าส่งขั้นต่ำ ครอบ 1 กม. แรก (design SA6) */
    deliveryBaseSatang: satang('delivery_base_satang').notNull().default(1500),
    /** คิดเพิ่มต่อกิโลเมตรหลังจากกิโลแรก */
    deliveryPerKmSatang: satang('delivery_per_km_satang').notNull().default(600),
    serviceFeeSatang: satang('service_fee_satang').notNull().default(500),

    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedByAccountId: uuid('updated_by_account_id').references(() => accounts.id),
  },
  (t) => [
    check('platform_pricing_single_row', sql`${t.singleton} = true`),
    /** ขอบเขตที่ยอมให้ตั้งได้ ไม่ใช่ความเห็นเรื่องราคา แต่เป็นตาข่ายกันพิมพ์ผิด */
    check('platform_pricing_commission_sane', sql`${t.commissionRateBp} between 100 and 3000`),
    check('platform_pricing_fees_sane', sql`
      ${t.deliveryBaseSatang} >= 0 and ${t.deliveryPerKmSatang} >= 0 and ${t.serviceFeeSatang} >= 0
    `),
  ],
);

/** สวิตช์เปิด/ปิดฟีเจอร์รายตัว (design SA4) */
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByAccountId: uuid('updated_by_account_id').references(() => accounts.id),
});

/** ประวัติการกระทำที่แตะเงินหรือสิทธิ์ (design SA5) */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** ใครกด ไม่มี null เพราะทุกการกระทำในตารางนี้มีคนสั่งเสมอ */
    actorAccountId: uuid('actor_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    /** เช่น "refund.approved" "restaurant.settled" "pricing.changed" "role.granted" */
    action: text('action').notNull(),
    /** ชนิดของสิ่งที่ถูกกระทำ เช่น "refund_case" "restaurant" "account" "platform_pricing" */
    subjectType: text('subject_type').notNull(),
    /** id ของสิ่งนั้น เป็น text ไม่ใช่ uuid เพราะ subject บางอย่างไม่มี uuid (เช่น flag key) */
    subjectId: text('subject_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_created_idx').on(t.createdAt),
    index('audit_log_action_idx').on(t.action),
    index('audit_log_actor_idx').on(t.actorAccountId),
  ],
);
