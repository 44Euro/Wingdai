import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { ledgerAccount, refundFault, refundStatus } from './enums';
import { satang } from './money';
import { accounts } from './accounts';
import { orders } from './orders';

/**
 * claude.md §6.2 — บัญชีคู่ เขียนอย่างเดียว ห้ามแก้ห้ามลบ
 *
 * กติกาที่ต้องบังคับให้ได้ ไม่ใช่แค่หวังว่าโค้ดจะทำถูก:
 * 1. **ห้าม UPDATE ห้าม DELETE** — แก้ผิดด้วยการเขียนรายการกลับทาง (reversal) เท่านั้น
 *    บังคับด้วย trigger ใน migration ไม่ใช่แค่ระเบียบในหัว
 * 2. **ทุก entry_group_id ต้องมีเดบิตรวม = เครดิตรวม** — ตรวจด้วย constraint trigger
 *    ที่ทำงานตอน COMMIT เพราะระหว่าง transaction ยอดยังไม่บาลานซ์เป็นเรื่องปกติ
 * 3. **เขียนใน transaction เดียวกับที่เปลี่ยนสถานะออร์เดอร์** — เป็นหน้าที่ของชั้นแอป
 *
 * เก็บเดบิตกับเครดิตเป็นคนละช่อง ไม่ใช่ยอดเดียวที่ติดลบได้ เพราะบัญชีคู่อ่านง่ายกว่ามาก
 * เวลาไล่ดูด้วยตา และทำให้ constraint บาลานซ์เขียนได้ตรงไปตรงมา
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** ทุกแถวที่เกิดจากเหตุการณ์เดียวกันใช้ค่านี้ร่วมกัน — หน่วยที่ต้องบาลานซ์คือกลุ่มนี้ */
    entryGroupId: uuid('entry_group_id').notNull(),
    account: ledgerAccount('account').notNull(),
    debitSatang: satang('debit_satang').notNull().default(0),
    creditSatang: satang('credit_satang').notNull().default(0),

    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
    /** ไรเดอร์/ร้านที่ยอดนี้เป็นของเขา — ใช้ตอนรวมยอดจ่ายรายสัปดาห์ */
    counterpartyAccountId: uuid('counterparty_account_id').references(() => accounts.id),

    /** อธิบายว่าแถวนี้เกิดจากอะไร เช่น "order.delivered" "refund.approved" "payout.weekly" */
    reason: text('reason').notNull(),
    /** ถ้าเป็นรายการกลับทาง ชี้ไปที่กลุ่มที่กำลังกลับ */
    reversesEntryGroupId: uuid('reverses_entry_group_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ledger_entries_group_idx').on(t.entryGroupId),
    index('ledger_entries_order_idx').on(t.orderId),
    index('ledger_entries_account_created_idx').on(t.account, t.createdAt),
    index('ledger_entries_counterparty_idx').on(t.counterpartyAccountId),

    // แต่ละแถวเป็นเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง ไม่ใช่ทั้งคู่ และไม่ใช่ศูนย์ทั้งคู่
    check('ledger_entries_one_side_only', sql`
      (${t.debitSatang} > 0 and ${t.creditSatang} = 0)
      or (${t.creditSatang} > 0 and ${t.debitSatang} = 0)
    `),
  ],
);

/**
 * claude.md §6.4 — เคสคืนเงิน/ข้อพิพาท
 * ระบบตรวจเองแล้วเสนอคำตอบ แอดมินกดยืนยัน แล้วระบบออกรายการกลับทางให้อัตโนมัติ
 * ห้ามให้แอดมินไปแก้ ledger เอง
 */
export const refundCases = pgTable(
  'refund_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    reportedByAccountId: uuid('reported_by_account_id')
      .notNull()
      .references(() => accounts.id),
    status: refundStatus('status').notNull().default('open'),

    customerReason: text('customer_reason').notNull(),
    evidencePhotoPath: text('evidence_photo_path'),

    /** ผลตรวจอัตโนมัติ + เหตุผล — เอาไปโชว์ให้แอดมินอ่านก่อนกดยืนยัน */
    autoVerdict: text('auto_verdict'),
    autoReasoning: text('auto_reasoning'),
    suggestedAmountSatang: satang('suggested_amount_satang'),

    /** ใครรับผิดชอบค่าใช้จ่าย — ต้องเก็บไว้ใช้คำนวณรอบจ่ายเงินและทำรายงาน (§6.4) */
    fault: refundFault('fault'),
    approvedAmountSatang: satang('approved_amount_satang'),
    decidedByAccountId: uuid('decided_by_account_id').references(() => accounts.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    /** กลุ่ม ledger ที่ระบบออกให้ตอนแอดมินกดอนุมัติ */
    ledgerEntryGroupId: uuid('ledger_entry_group_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('refund_cases_status_idx').on(t.status),
    index('refund_cases_order_idx').on(t.orderId),
  ],
);
