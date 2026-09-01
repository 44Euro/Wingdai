import type { RefundFault } from '../ledger/postRefund';

/** ตรวจอัตโนมัติแล้ว เสนอ คำตัดสิน product-spec §6.4 */

/** เรื่องที่ลูกค้าแจ้งได้ ตัวที่ตัดสินว่าใครรับผิดชอบตามธรรมเนียมใน §6.4 */
export type RefundReason =
  | 'wrong_item'      // ได้ของผิด
  | 'missing_item'    // ของขาด
  | 'food_quality'    // อาหารมีปัญหา
  | 'damaged'         // หก/เสียหายระหว่างทาง
  | 'not_delivered'   // ไม่ได้รับของ
  | 'late'            // ส่งช้ามาก
  | 'other';

/** §6.4 กำหนดธรรมเนียมไว้สามข้อ: ของผิด → ร้าน หกเสียหายระหว่างส่ง → ไรเดอร์ */
const FAULT_BY_REASON: Record<RefundReason, RefundFault | null> = {
  wrong_item: 'restaurant',
  missing_item: 'restaurant',
  food_quality: 'restaurant',
  damaged: 'rider',
  not_delivered: 'rider',
  late: 'platform',
  other: null,
};

/** เกินเวลานี้หลังส่งถึงแล้วแจ้งไม่ได้ ยิ่งนานยิ่งพิสูจน์ไม่ได้ว่าเกิดอะไรขึ้นจริง */
export const DISPUTE_WINDOW_HOURS = 24;

/** ต่ำกว่านี้เสนอคืนเต็มได้เลย เพราะค่าเวลาที่แอดมินต้องมานั่งสอบสวนแพงกว่าตัวเงิน */
export const FAST_REFUND_CEILING_SATANG = 20_000;

/** เกินสัดส่วนนี้ = แจ้งปัญหาบ่อยผิดปกติ เป็นสัญญาณโกง ไม่ใช่หลักฐานว่าโกง */
export const SUSPICIOUS_DISPUTE_RATE = 0.3;
/** ต่ำกว่านี้ตัดสินจากสัดส่วนไม่ได้ สั่ง 2 ครั้งแล้วมีปัญหา 1 ครั้งไม่ได้แปลว่าโกง */
export const MIN_ORDERS_FOR_RATE = 5;

export type RefundFacts = {
  reason: RefundReason;
  /** ยอดที่ลูกค้าจ่ายไปทั้งใบ เพดานของการคืนเงิน */
  orderTotalSatang: number;
  orderStatus: 'created' | 'accepted' | 'preparing' | 'picked_up' | 'delivered' | 'cancelled';
  deliveredAt: Date | null;
  reportedAt: Date;
  /** ลูกค้าแนบรูปมาไหม */
  hasCustomerPhoto: boolean;
  /** ไรเดอร์ถ่ายรูปตอนส่งไว้ไหม */
  hasDeliveryPhoto: boolean;
  customerOrderCount: number;
  customerDisputeCount: number;
};

export type RefundVerdict =
  /** เสนอคืนเต็ม รอแอดมินกดยืนยัน */
  | 'suggest_full'
  /** ต้องดูก่อน ระบบไม่เสนอยอด */
  | 'needs_review'
  /** ไม่เข้าเงื่อนไขตั้งแต่ต้น (นอกเวลา / ออร์เดอร์ยังไม่ถึงมือ) */
  | 'not_eligible';

export type RefundRecommendation = {
  verdict: RefundVerdict;
  /** ยอดที่ระบบเสนอ null = ไม่เสนอ ให้แอดมินกรอกเอง */
  suggestedAmountSatang: number | null;
  fault: RefundFault | null;
  /** เหตุผลเป็นข้อ ๆ ให้แอดมินอ่านก่อนกด §6.4 ห้ามโชว์แค่ปุ่มคืนเงินเปล่า ๆ */
  reasoning: string[];
};

export function recommendRefund(f: RefundFacts): RefundRecommendation {
  const reasoning: string[] = [];

  /** ยังไม่ส่งถึงก็ยังไม่มีอะไรให้พิพาทเรื่องคุณภาพ ยกเลิกออร์เดอร์เป็นคนละเรื่อง */
  if (f.orderStatus !== 'delivered' && f.reason !== 'not_delivered') {
    return {
      verdict: 'not_eligible',
      suggestedAmountSatang: null,
      fault: null,
      reasoning: ['ออเดอร์ยังไม่ถึงสถานะส่งถึงแล้ว ยังไม่เข้าเงื่อนไขแจ้งปัญหา'],
    };
  }

  if (f.deliveredAt) {
    const hoursSince = (f.reportedAt.getTime() - f.deliveredAt.getTime()) / 3_600_000;
    if (hoursSince > DISPUTE_WINDOW_HOURS) {
      return {
        verdict: 'not_eligible',
        suggestedAmountSatang: null,
        fault: null,
        reasoning: [`แจ้งหลังส่งถึงแล้ว ${Math.floor(hoursSince)} ชม. เกินกำหนด ${DISPUTE_WINDOW_HOURS} ชม.`],
      };
    }
    reasoning.push(`แจ้งภายใน ${Math.max(0, Math.floor(hoursSince))} ชม. หลังส่งถึง — อยู่ในกำหนด`);
  }

  const fault = FAULT_BY_REASON[f.reason];
  if (fault === null) {
    reasoning.push('เหตุผลที่แจ้งไม่เข้าหมวดใดที่กำหนดความรับผิดไว้ ต้องให้คนตัดสินว่าใครรับผิดชอบ');
  }

  /** สัญญาณโกง ไม่ใช่หลักฐาน จึงมีผลแค่ "ให้คนดูก่อน" ไม่ใช่ปฏิเสธอัตโนมัติ */
  const rate = f.customerOrderCount > 0 ? f.customerDisputeCount / f.customerOrderCount : 0;
  const suspicious = f.customerOrderCount >= MIN_ORDERS_FOR_RATE && rate > SUSPICIOUS_DISPUTE_RATE;
  if (suspicious) {
    reasoning.push(
      `ลูกค้ารายนี้แจ้งปัญหา ${f.customerDisputeCount} จาก ${f.customerOrderCount} ออเดอร์ ` +
        `(${Math.round(rate * 100)}%) สูงผิดปกติ`,
    );
  }

  if (f.hasCustomerPhoto) reasoning.push('ลูกค้าแนบรูปประกอบมาด้วย');
  else reasoning.push('ลูกค้าไม่ได้แนบรูป');

  /** "ไม่ได้รับของ" คือการโต้แย้งว่าสถานะที่ระบบบันทึกไว้นั่นแหละผิด */
  const unverifiableClaim = f.reason === 'not_delivered';
  if (unverifiableClaim) {
    reasoning.push(
      f.hasDeliveryPhoto
        ? 'ไรเดอร์มีรูปยืนยันการส่ง — ขัดกับที่ลูกค้าแจ้ง ต้องเทียบรูปก่อนตัดสิน'
        : 'ไม่มีรูปยืนยันการส่งจากไรเดอร์ ระบบตรวจเองไม่ได้ว่าเกิดอะไรขึ้น',
    );
  }

  const overCeiling = f.orderTotalSatang > FAST_REFUND_CEILING_SATANG;
  if (overCeiling) {
    reasoning.push(
      `ยอด ${(f.orderTotalSatang / 100).toFixed(2)} บาท เกินเกณฑ์เสนอคืนเร็ว ` +
        `${FAST_REFUND_CEILING_SATANG / 100} บาท`,
    );
  }

  /** เสนอคืนเต็มได้ก็ต่อเมื่อ ทุกข้อผ่านหมด ข้อเดียวสะดุดก็ส่งให้คนดู */
  const canSuggestFull = fault !== null && !suspicious && !overCeiling && !unverifiableClaim;

  if (canSuggestFull) {
    reasoning.push('ตรวจอัตโนมัติผ่านทุกข้อ — เสนอคืนเต็มจำนวน');
    return {
      verdict: 'suggest_full',
      suggestedAmountSatang: f.orderTotalSatang,
      fault,
      reasoning,
    };
  }

  return {
    verdict: 'needs_review',
    // ไม่เสนอยอดเมื่อยังตัดสินไม่ได้ เลขที่ระบบใส่มาให้จะกลายเป็นเลขที่แอดมินกดตามโดยไม่คิด
    suggestedAmountSatang: null,
    fault,
    reasoning,
  };
}

/** §8 อัตราคืนเงิน > 2% = มีอะไรพังเชิงระบบ ไม่ใช่ความผันผวนปกติ */
export const REFUND_RATE_ALERT = 0.02;
