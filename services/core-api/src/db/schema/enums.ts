import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * claude.md §7: มีสามค่าเท่านั้น — merchant ไม่ใช่ค่าใน enum นี้
 * ความเป็นร้านอยู่ที่ restaurants.owner_user_id ซึ่งชี้กลับมาที่บัญชี type 'user'
 */
export const accountType = pgEnum('account_type', ['user', 'rider', 'admin']);

export const riderApprovalStatus = pgEnum('rider_approval_status', [
  'pending',
  'approved',
  'rejected',
]);

export const cuisineCategory = pgEnum('cuisine_category', [
  'rice',
  'noodle',
  'somtam',
  'drink',
  'dessert',
]);

/** ต้องตรงกับ apps/mobile/src/data/orderStateMachine.ts เป๊ะ */
export const orderStatus = pgEnum('order_status', [
  'created',
  'accepted',
  'preparing',
  'picked_up',
  'delivered',
  'cancelled',
]);

/** claude.md §6.5 — บัตรยังปิดอยู่ที่ชั้น UI แต่เก็บค่าไว้ในฐานได้เลย จะได้ไม่ต้อง migrate ตอนเปิดใช้ */
export const paymentMethod = pgEnum('payment_method', ['promptpay', 'cash', 'card']);

export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
]);

/**
 * ผังบัญชีของ ledger (claude.md §6.2)
 * rider_cash_held = เงินสดที่ไรเดอร์เก็บจากลูกค้าแล้วยังไม่ได้คืนบริษัท
 */
export const ledgerAccount = pgEnum('ledger_account', [
  'cash',
  'restaurant_payable',
  'rider_payable',
  'rider_cash_held',
  'payment_fee_expense',
  'platform_revenue',
  'refund_expense',
]);

/** claude.md §6.4 — ใครรับผิดชอบค่าใช้จ่ายของการคืนเงิน */
export const refundFault = pgEnum('refund_fault', ['restaurant', 'rider', 'platform']);

export const refundStatus = pgEnum('refund_status', [
  'open',
  'auto_verified',
  'approved',
  'rejected',
]);

/**
 * claude.md §7: โซนต้องมี type แต่ห้ามเอา type ไปแตกเงื่อนไขใน dispatch
 * เรื่องฤดูกาล/ช่วงปิดให้เก็บเป็นข้อมูลราย instance ไม่ใช่ if ตามชนิดโซน
 */
export const zoneType = pgEnum('zone_type', [
  'university',
  'condo_cluster',
  'office_district',
  'mixed',
]);
