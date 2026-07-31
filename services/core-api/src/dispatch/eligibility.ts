/** ใครถูกเสนองานใบนี้ได้บ้าง ด่านที่ต้องผ่าน ก่อน เอาไปให้คะแนน */

import { isWithinWorkBase } from './scoring';

export type RiderEligibilityInput = {
  accountId: string;
  approval: 'pending' | 'approved' | 'rejected';
  isOnline: boolean;
  /** สตางค์ที่ถืออยู่ตอนนี้ (§6.2) */
  cashHeldSatang: number;
  cashLimitSatang: number;
  /** YYYY-MM-DD */
  licenceExpiry: string;
  compulsoryInsuranceExpiry: string;
  /** ระยะจากจุดตั้งทำงานถึงร้าน (design R7) `null` = ไรเดอร์ยังไม่ปักหมุด จึงไม่กรอง */
  baseDistanceKm: number | null;
  baseRadiusKm: number;
};

export type JobEligibilityInput = {
  /** §4.3 ไรเดอร์รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้ */
  customerId: string;
  paymentMethod: 'promptpay' | 'cash' | 'card';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  /** ยอดรวมที่ต้องเก็บถ้าเป็นเงินสด (ค่าอาหาร + ค่าส่ง + ค่าบริการ) */
  grossSatang: number;
};

export type IneligibleReason =
  | 'not_approved'
  | 'offline'
  | 'own_order'
  | 'cash_limit'
  | 'licence_expired'
  | 'insurance_expired'
  | 'already_declined'
  | 'outside_work_base';

/** คืน `null` = รับงานนี้ได้ คืนเหตุผล = รับไม่ได้ */
export function ineligibleReason(args: {
  rider: RiderEligibilityInput;
  job: JobEligibilityInput;
  declinedBy: Set<string>;
  today: string;
}): IneligibleReason | null {
  const { rider, job } = args;

  if (rider.approval !== 'approved') return 'not_approved';

  /** ใบขับขี่ / พ.ร.บ. หมดอายุแล้วห้ามจ่ายงาน */
  if (rider.licenceExpiry < args.today) return 'licence_expired';
  if (rider.compulsoryInsuranceExpiry < args.today) return 'insurance_expired';

  // §4.3 ตรวจที่เซิร์ฟเวอร์ตอนจ่ายงาน ไม่ใช่แค่ซ่อนปุ่มในแอป
  if (job.customerId === rider.accountId) return 'own_order';

  if (!rider.isOnline) return 'offline';

  if (args.declinedBy.has(rider.accountId)) return 'already_declined';

  /** design R7 ไรเดอร์ตั้งจุดตั้งต้นกับรัศมีที่ยอมรับงานเอง */
  if (
    rider.baseDistanceKm !== null &&
    !isWithinWorkBase({ distanceFromBaseKm: rider.baseDistanceKm, radiusKm: rider.baseRadiusKm })
  ) {
    return 'outside_work_base';
  }

  /** §6.2 เพดานเงินสด เกินแล้วหยุดเสนองานเงินสด จนกว่าจะเคลียร์ */
  const collectsCash = job.paymentMethod === 'cash' && job.paymentStatus === 'pending';
  if (collectsCash && rider.cashHeldSatang + job.grossSatang > rider.cashLimitSatang) {
    return 'cash_limit';
  }

  return null;
}

export function isEligible(args: Parameters<typeof ineligibleReason>[0]): boolean {
  return ineligibleReason(args) === null;
}
