import {
  PAYMENT_METHOD_NAMES,
  gateOfPaymentMethod,
  type FeatureFlagKey,
  type PaymentMethodName,
} from './platform.service';

/** ช่องทางที่ระบบรู้จักแต่ตอนนี้ใช้ไม่ได้ `gate` คือคีย์ที่แอปเอาไปหาข้อความบอกเหตุผล */
export type UnavailablePaymentMethod = {
  method: PaymentMethodName;
  gate: FeatureFlagKey;
};

/**
 * แยกช่องทางจ่ายเงินเป็นใช้ได้กับใช้ไม่ได้ แทนที่จะคืนแค่ตัวที่ใช้ได้
 *
 * §6.5 สั่งว่าบัตรต้อง "listed in the picker but not selectable yet" การกรองตัวที่ปิดทิ้งไป
 * ทำให้ลูกค้าไม่รู้ว่าช่องทางนั้นมีอยู่และกำลังจะเปิด ซึ่งอ่านเหมือนแอปไม่รองรับเลย
 * เหตุผลผูกกับ gate ไม่ใช่ผูกกับชื่อช่องทาง ปิด flag ตัวไหนก็ได้ป้ายของตัวเองมาเอง
 */
export function splitPaymentMethods(flags: Record<FeatureFlagKey, boolean>): {
  available: PaymentMethodName[];
  unavailable: UnavailablePaymentMethod[];
} {
  const available: PaymentMethodName[] = [];
  const unavailable: UnavailablePaymentMethod[] = [];

  for (const method of PAYMENT_METHOD_NAMES) {
    const gate = gateOfPaymentMethod(method);
    if (!gate || flags[gate.flag]) {
      available.push(method);
    } else {
      unavailable.push({ method, gate: gate.flag });
    }
  }

  return { available, unavailable };
}
