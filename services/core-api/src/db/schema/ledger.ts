import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { ledgerAccount, refundFault, refundStatus, payoutStatus } from './enums';
import { satang } from './money';
import { accounts } from './accounts';
import { orders } from './orders';
import { restaurants } from './catalog';

/** product-spec §6.2 บัญชีคู่ เขียนอย่างเดียว ห้ามแก้ห้ามลบ */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** ทุกแถวที่เกิดจากเหตุการณ์เดียวกันใช้ค่านี้ร่วมกัน หน่วยที่ต้องบาลานซ์คือกลุ่มนี้ */
    entryGroupId: uuid('entry_group_id').notNull(),
    account: ledgerAccount('account').notNull(),
    debitSatang: satang('debit_satang').notNull().default(0),
    creditSatang: satang('credit_satang').notNull().default(0),

    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
    /** ไรเดอร์ที่ยอดนี้เป็นของเขา ใช้ตอนรวมยอดจ่ายให้ไรเดอร์ */
    counterpartyAccountId: uuid('counterparty_account_id').references(() => accounts.id),
    /** ร้านที่ยอดนี้เป็นของเขา ใส่เฉพาะแถว `restaurant_payable` */
    restaurantId: uuid('restaurant_id').references(() => restaurants.id),

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
    index('ledger_entries_restaurant_idx').on(t.restaurantId),

    // แต่ละแถวเป็นเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง ไม่ใช่ทั้งคู่ และไม่ใช่ศูนย์ทั้งคู่
    check('ledger_entries_one_side_only', sql`
      (${t.debitSatang} > 0 and ${t.creditSatang} = 0)
      or (${t.creditSatang} > 0 and ${t.debitSatang} = 0)
    `),
  ],
);

/** product-spec §6.4 เคสคืนเงิน/ข้อพิพาท */
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

    /** ผลตรวจอัตโนมัติ + เหตุผล เอาไปโชว์ให้แอดมินอ่านก่อนกดยืนยัน */
    autoVerdict: text('auto_verdict'),
    autoReasoning: text('auto_reasoning'),
    suggestedAmountSatang: satang('suggested_amount_satang'),

    /** ใครรับผิดชอบค่าใช้จ่าย ต้องเก็บไว้ใช้คำนวณรอบจ่ายเงินและทำรายงาน (§6.4) */
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

/** คำขอถอนเงินของไรเดอร์ (product-spec §6.4 กึ่งอัตโนมัติ คนกดยืนยันก่อนเงินออก) */
export const riderPayouts = pgTable(
  'rider_payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    amountSatang: satang('amount_satang').notNull(),
    status: payoutStatus('status').notNull().default('requested'),
    rejectionReason: text('rejection_reason'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    check('rider_payouts_amount_positive', sql`${t.amountSatang} > 0`),
    uniqueIndex('rider_payouts_one_pending')
      .on(t.accountId)
      .where(sql`${t.status} = 'requested'`),
    index('rider_payouts_account_idx').on(t.accountId),
    // ตัดสินแล้วต้องมีเวลาที่ตัดสิน และปฏิเสธต้องมีเหตุผล ไม่งั้นไรเดอร์ไม่รู้ว่าทำไม
    check('rider_payouts_decided_has_time', sql`
      (${t.status} = 'requested' and ${t.decidedAt} is null)
      or (${t.status} <> 'requested' and ${t.decidedAt} is not null)
    `),
    check('rider_payouts_rejected_has_reason', sql`
      ${t.status} <> 'rejected' or ${t.rejectionReason} is not null
    `),
  ],
);

/**
 * ร้านขอถอนยอดที่ค้างจ่าย แล้วแอดมินอนุมัติ โครงเดียวกับของไรเดอร์ (design R12)
 * §6.2 วางรอบโอนอัตโนมัติไว้เฟส 2 อันนี้คือฉบับที่คนกดอนุมัติ แต่ลงบัญชีแบบเดียวกัน
 */
export const merchantPayouts = pgTable(
  'merchant_payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'restrict' }),
    amountSatang: satang('amount_satang').notNull(),
    status: payoutStatus('status').notNull().default('requested'),
    rejectionReason: text('rejection_reason'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    check('merchant_payouts_amount_positive', sql`${t.amountSatang} > 0`),
    // ขอค้างได้ทีละใบต่อร้าน ไม่งั้นกดรัวแล้วถอนเกินยอดที่มี
    uniqueIndex('merchant_payouts_one_pending')
      .on(t.restaurantId)
      .where(sql`${t.status} = 'requested'`),
    index('merchant_payouts_restaurant_idx').on(t.restaurantId),
    check('merchant_payouts_decided_has_time', sql`
      (${t.status} = 'requested' and ${t.decidedAt} is null)
      or (${t.status} <> 'requested' and ${t.decidedAt} is not null)
    `),
    check('merchant_payouts_rejected_has_reason', sql`
      ${t.status} <> 'rejected' or ${t.rejectionReason} is not null
    `),
  ],
);
