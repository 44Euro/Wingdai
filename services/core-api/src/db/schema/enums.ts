import { pgEnum } from 'drizzle-orm/pg-core';

/** product-spec §7 สี่ค่า merchant ไม่ใช่ค่าใน enum นี้ */
export const accountType = pgEnum('account_type', ['user', 'rider', 'admin', 'super_admin']);

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

/** product-spec §6.5 บัตรยังปิดอยู่ที่ชั้น UI แต่เก็บค่าไว้ในฐานได้เลย จะได้ไม่ต้อง migrate ตอนเปิดใช้ */
export const paymentMethod = pgEnum('payment_method', ['promptpay', 'cash', 'card']);

export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
]);

/** ผังบัญชีของ ledger (product-spec §6.2) */
export const ledgerAccount = pgEnum('ledger_account', [
  'cash',
  'restaurant_payable',
  'rider_payable',
  'rider_cash_held',
  'payment_fee_expense',
  'platform_revenue',
  'refund_expense',
]);

/** product-spec §6.4 ใครรับผิดชอบค่าใช้จ่ายของการคืนเงิน */
export const refundFault = pgEnum('refund_fault', ['restaurant', 'rider', 'platform']);

/** สถานะคำขอถอนเงินของไรเดอร์ (product-spec §6.4 กึ่งอัตโนมัติ) */
export const payoutStatus = pgEnum('payout_status', ['requested', 'paid', 'rejected']);

/** ปัญหาที่ไรเดอร์แจ้งระหว่างส่ง (design R9) */
export const riderIssueKind = pgEnum('rider_issue_kind', [
  'cannot_reach_customer',
  'bad_address',
  'accident',
]);

export const refundStatus = pgEnum('refund_status', [
  'open',
  'auto_verified',
  'approved',
  'rejected',
]);

/** product-spec §7: โซนต้องมี type แต่ห้ามเอา type ไปแตกเงื่อนไขใน dispatch */
export const zoneType = pgEnum('zone_type', [
  'university',
  'condo_cluster',
  'office_district',
  'mixed',
]);

/** เหตุผลที่ร้านปฏิเสธออเดอร์ (design M12) */
export const cancelReason = pgEnum('cancel_reason', [
  'out_of_stock',
  'too_busy',
  'closing_soon',
  'other',
]);

/** ฝ่ายที่กดยกเลิก ลูกค้าต้องรู้ว่า "ฉันกดเอง" กับ "ร้านปฏิเสธ" ต่างกัน */
export const cancelledBy = pgEnum('cancelled_by', ['customer', 'restaurant', 'admin']);
