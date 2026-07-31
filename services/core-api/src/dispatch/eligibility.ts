/**
 * ใครถูกเสนองานใบนี้ได้บ้าง — ด่านที่ต้องผ่าน **ก่อน** เอาไปให้คะแนน
 *
 * แยกจาก scoring.ts โดยตั้งใจ: คะแนนคือ "ใครควรได้ก่อน" ส่วนไฟล์นี้คือ "ใครห้ามได้เลย"
 * ปนกันเมื่อไหร่ กติกาที่ห้ามเด็ดขาดจะกลายเป็นแค่คะแนนติดลบที่ชนะได้ด้วยพจน์อื่น
 */

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
};

export type JobEligibilityInput = {
  /** §4.3 — ไรเดอร์รับงานออร์เดอร์ที่ตัวเองสั่งไม่ได้ */
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
  | 'already_declined';

/**
 * คืน `null` = รับงานนี้ได้ · คืนเหตุผล = รับไม่ได้
 *
 * เรียงจากเรื่องที่ร้ายแรงที่สุดลงมา เพราะเหตุผลแรกที่เจอคือสิ่งที่ log กับจอแอดมินจะเห็น
 */
export function ineligibleReason(args: {
  rider: RiderEligibilityInput;
  job: JobEligibilityInput;
  declinedBy: Set<string>;
  today: string;
}): IneligibleReason | null {
  const { rider, job } = args;

  if (rider.approval !== 'approved') return 'not_approved';

  /*
   * ใบขับขี่ / พ.ร.บ. หมดอายุแล้วห้ามจ่ายงาน
   *
   * claude.md §7 บอกให้ "เก็บวันหมดอายุ" แต่ไม่ได้เขียนว่าให้บังคับตอนจ่ายงาน
   * ที่นี่บังคับ เพราะการส่งไรเดอร์ที่ใบขับขี่หมดอายุออกไปวิ่งงานของเรา
   * เป็นความรับผิดของแพลตฟอร์ม ไม่ใช่แค่ข้อมูลที่เก็บไว้เฉย ๆ — ทบทวนได้ถ้าไม่เห็นด้วย
   */
  if (rider.licenceExpiry < args.today) return 'licence_expired';
  if (rider.compulsoryInsuranceExpiry < args.today) return 'insurance_expired';

  // §4.3 ตรวจที่เซิร์ฟเวอร์ตอนจ่ายงาน ไม่ใช่แค่ซ่อนปุ่มในแอป
  if (job.customerId === rider.accountId) return 'own_order';

  if (!rider.isOnline) return 'offline';

  if (args.declinedBy.has(rider.accountId)) return 'already_declined';

  /*
   * §6.2 เพดานเงินสด — เกินแล้วหยุดเสนองานเงินสด จนกว่าจะเคลียร์
   * ไรเดอร์ถือเงินบริษัทก้อนใหญ่คือความเสี่ยงของแพลตฟอร์ม ไม่ใช่ของไรเดอร์
   * (ใบที่จ่ายแล้วไม่นับ เพราะไม่มีเงินสดให้เก็บ)
   */
  const collectsCash = job.paymentMethod === 'cash' && job.paymentStatus === 'pending';
  if (collectsCash && rider.cashHeldSatang + job.grossSatang > rider.cashLimitSatang) {
    return 'cash_limit';
  }

  return null;
}

export function isEligible(args: Parameters<typeof ineligibleReason>[0]): boolean {
  return ineligibleReason(args) === null;
}
